require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { Day, Transaction, Photo } = require('./models');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos';
const TIMEZONE = process.env.TIMEZONE || 'Asia/Manila';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Photo must be a JPEG, PNG, WEBP or GIF image.'));
  },
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- helpers ----------

// Today's date (YYYY-MM-DD) in the store's time zone.
function todayString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Pesos (number or string) -> integer centavos. Throws on bad input.
function toCentavos(value, label) {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new HttpError(400, `${label} must be a valid amount of 0 or more.`);
  }
  return Math.round(n * 100);
}

const toPesos = (c) => (c == null ? null : c / 100);

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function summarize(day) {
  const [agg] = await Transaction.aggregate([
    { $match: { date: day.date } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        sales: { $sum: '$total' },
        cashReceived: { $sum: '$cashReceived' },
        changeGiven: { $sum: '$change' },
      },
    },
  ]);
  const sales = agg ? agg.sales : 0;
  const expectedCash = day.startingCash + sales;
  return {
    date: day.date,
    startingCash: toPesos(day.startingCash),
    transactionCount: agg ? agg.count : 0,
    totalSales: toPesos(sales),
    cashReceived: toPesos(agg ? agg.cashReceived : 0),
    changeGiven: toPesos(agg ? agg.changeGiven : 0),
    expectedCash: toPesos(expectedCash),
    countedCash: toPesos(day.countedCash),
    difference: day.countedCash == null ? null : toPesos(day.countedCash - expectedCash),
    openedAt: day.openedAt,
    closedAt: day.closedAt,
    isClosed: !!day.closedAt,
    notes: day.notes,
  };
}

function serializeTransaction(t) {
  return {
    id: t._id,
    number: t.number,
    date: t.date,
    items: t.items.map((i) => ({
      name: i.name,
      price: toPesos(i.price),
      quantity: i.quantity,
      subtotal: toPesos(i.price * i.quantity),
    })),
    total: toPesos(t.total),
    cashReceived: toPesos(t.cashReceived),
    change: toPesos(t.change),
    photoUrl: `/api/photos/${t.photo}`,
    createdAt: t.createdAt,
  };
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- routes ----------

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Status of today's register.
app.get(
  '/api/today',
  wrap(async (req, res) => {
    const date = todayString();
    const day = await Day.findOne({ date });
    res.json({ date, timezone: TIMEZONE, day: day ? await summarize(day) : null });
  })
);

// Open the register for today with a starting cash amount.
app.post(
  '/api/today/open',
  wrap(async (req, res) => {
    const date = todayString();
    const startingCash = toCentavos(req.body.startingCash, 'Starting cash');
    if (await Day.exists({ date })) throw new HttpError(409, 'The register is already open for today.');
    const day = await Day.create({ date, startingCash });
    res.status(201).json(await summarize(day));
  })
);

// Close today's register, recording the actual counted cash.
app.post(
  '/api/today/close',
  wrap(async (req, res) => {
    const date = todayString();
    const day = await Day.findOne({ date });
    if (!day) throw new HttpError(404, 'The register has not been opened today.');
    if (day.closedAt) throw new HttpError(409, 'The register is already closed for today.');
    day.countedCash = toCentavos(req.body.countedCash, 'Counted cash');
    day.notes = String(req.body.notes || '').slice(0, 500);
    day.closedAt = new Date();
    await day.save();
    res.json(await summarize(day));
  })
);

// Record a sale. multipart/form-data with fields:
//   items:        JSON array of { name, price, quantity }
//   cashReceived: amount handed over by the customer
//   photo:        image file (required, proof of the product sold)
app.post(
  '/api/transactions',
  upload.single('photo'),
  wrap(async (req, res) => {
    const date = todayString();
    const day = await Day.findOne({ date });
    if (!day) throw new HttpError(400, 'Open the register with a starting cash amount first.');
    if (day.closedAt) throw new HttpError(400, 'The register is already closed for today.');
    if (!req.file) throw new HttpError(400, 'A photo of the product is required as proof.');

    let rawItems;
    try {
      rawItems = JSON.parse(req.body.items || '[]');
    } catch {
      throw new HttpError(400, 'Items are not valid.');
    }
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new HttpError(400, 'Add at least one product.');
    }
    const items = rawItems.map((it, i) => {
      const name = String(it.name || '').trim();
      if (!name) throw new HttpError(400, `Product #${i + 1} needs a name.`);
      const quantity = Number(it.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new HttpError(400, `Quantity for "${name}" must be a whole number of 1 or more.`);
      }
      const price = toCentavos(it.price, `Price of "${name}"`);
      if (price === 0) throw new HttpError(400, `Price of "${name}" must be more than 0.`);
      return { name: name.slice(0, 120), price, quantity };
    });

    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const cashReceived = toCentavos(req.body.cashReceived, 'Cash received');
    if (cashReceived < total) {
      throw new HttpError(400, `Cash received is short by ₱${((total - cashReceived) / 100).toFixed(2)}.`);
    }
    const change = cashReceived - total;

    const photo = await Photo.create({
      data: req.file.buffer,
      contentType: req.file.mimetype,
      size: req.file.size,
    });

    // Assign the next transaction number for the day; retry if two sales race.
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await Transaction.findOne({ date }).sort({ number: -1 }).select('number');
      try {
        const t = await Transaction.create({
          date,
          number: last ? last.number + 1 : 1,
          items,
          total,
          cashReceived,
          change,
          photo: photo._id,
        });
        return res.status(201).json({ transaction: serializeTransaction(t), day: await summarize(day) });
      } catch (err) {
        if (err.code !== 11000) {
          await Photo.deleteOne({ _id: photo._id });
          throw err;
        }
      }
    }
    await Photo.deleteOne({ _id: photo._id });
    throw new HttpError(503, 'Could not save the sale, please try again.');
  })
);

// Transactions for a given day (defaults to today).
app.get(
  '/api/transactions',
  wrap(async (req, res) => {
    const date = req.query.date || todayString();
    if (!isValidDate(date)) throw new HttpError(400, 'Date must look like YYYY-MM-DD.');
    const day = await Day.findOne({ date });
    const txns = await Transaction.find({ date }).sort({ number: -1 });
    res.json({
      date,
      day: day ? await summarize(day) : null,
      transactions: txns.map(serializeTransaction),
    });
  })
);

// List of past days with their summaries (newest first).
app.get(
  '/api/days',
  wrap(async (req, res) => {
    const days = await Day.find().sort({ date: -1 }).limit(90);
    res.json(await Promise.all(days.map(summarize)));
  })
);

app.get(
  '/api/photos/:id',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Photo not found.');
    const photo = await Photo.findById(req.params.id);
    if (!photo) throw new HttpError(404, 'Photo not found.');
    res.set('Content-Type', photo.contentType);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(photo.data);
  })
);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 5 MB).' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'That record already exists.' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// ---------- start ----------

async function start() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  app.listen(PORT, () => console.log(`POS running at http://localhost:${PORT} (timezone ${TIMEZONE})`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
}

module.exports = { app };
