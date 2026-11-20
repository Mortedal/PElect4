// Routes used at the register by both the cashier and the owner.
const express = require('express');
const multer = require('multer');
const { Day, Transaction, CashMovement, Photo } = require('../models');
const { requireAuth, requireOwner } = require('../auth');
const {
  HttpError, wrap, todayString, toCentavos, cleanText, TIMEZONE,
  summarizeDay, cashierView, serializeTransaction, serializeMovement, dayTotals, expectedCashOf,
} = require('../lib');

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 2 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Photos must be JPEG, PNG, WEBP or GIF images.'));
  },
});

const router = express.Router();
router.use(requireAuth);

// The summary the current user is allowed to see.
async function summaryFor(user, day) {
  const s = await summarizeDay(day);
  return user.role === 'owner' ? s : cashierView(s);
}

async function getOpenDay() {
  const day = await Day.findOne({ date: todayString() });
  if (!day) throw new HttpError(400, 'Open the register with a starting cash amount first.');
  if (day.closedAt) throw new HttpError(400, 'The register is already closed for today.');
  return day;
}

async function savePhoto(file) {
  return Photo.create({ data: file.buffer, contentType: file.mimetype, size: file.size });
}

router.get(
  '/today',
  wrap(async (req, res) => {
    const date = todayString();
    const day = await Day.findOne({ date });
    res.json({ date, timezone: TIMEZONE, day: day ? await summaryFor(req.user, day) : null });
  })
);

router.post(
  '/today/open',
  wrap(async (req, res) => {
    const date = todayString();
    const startingCash = toCentavos(req.body.startingCash, 'Starting cash');
    if (await Day.exists({ date })) throw new HttpError(409, 'The register is already open for today.');
    const day = await Day.create({ date, startingCash, openedBy: req.user.name });
    res.status(201).json(await summaryFor(req.user, day));
  })
);

router.post(
  '/today/close',
  wrap(async (req, res) => {
    const day = await getOpenDay();
    day.countedCash = toCentavos(req.body.countedCash, 'Counted cash');
    day.notes = cleanText(req.body.notes, 500);
    day.closedAt = new Date();
    day.closedBy = req.user.name;
    await day.save();
    res.json(await summaryFor(req.user, day));
  })
);

// Owner: reopen today's register if it was closed by mistake.
router.post(
  '/today/reopen',
  requireOwner,
  wrap(async (req, res) => {
    const day = await Day.findOne({ date: todayString() });
    if (!day || !day.closedAt) throw new HttpError(400, 'The register is not closed.');
    day.closedAt = null;
    day.closedBy = '';
    day.countedCash = null;
    await day.save();
    res.json(await summarizeDay(day));
  })
);

// Owner: correct today's starting cash.
router.patch(
  '/today/starting-cash',
  requireOwner,
  wrap(async (req, res) => {
    const day = await getOpenDay();
    day.startingCash = toCentavos(req.body.startingCash, 'Starting cash');
    await day.save();
    res.json(await summarizeDay(day));
  })
);

// Record a sale. multipart/form-data fields:
//   category:     "clothing" | "other"
//   method:       "cash" | "online"
//   items:        JSON array of { name, price, quantity }
//   cashReceived: cash handed over (cash payments only)
//   reference:    reference number (online payments, optional)
//   photo:        product photo (required for clothing)
//   proof:        screenshot/photo of the online payment (required for online)
router.post(
  '/transactions',
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'proof', maxCount: 1 }]),
  wrap(async (req, res) => {
    const day = await getOpenDay();
    const date = day.date;

    const category = req.body.category === 'other' ? 'other' : req.body.category === 'clothing' ? 'clothing' : null;
    if (!category) throw new HttpError(400, 'Choose whether the sale is Clothing or Other sales.');
    const method = req.body.method === 'online' ? 'online' : req.body.method === 'cash' ? 'cash' : null;
    if (!method) throw new HttpError(400, 'Choose Cash or Online payment.');

    const photoFile = req.files?.photo?.[0];
    const proofFile = req.files?.proof?.[0];
    if (category === 'clothing' && !photoFile) throw new HttpError(400, 'A photo of the product is required.');
    if (method === 'online' && !proofFile) throw new HttpError(400, 'A photo of the online payment is required.');

    let rawItems;
    try {
      rawItems = JSON.parse(req.body.items || '[]');
    } catch {
      throw new HttpError(400, 'Items are not valid.');
    }
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpError(400, 'Add at least one item.');
    if (rawItems.length > 50) throw new HttpError(400, 'Too many items in one sale.');
    const items = rawItems.map((it, i) => {
      const name = cleanText(it.name, 120);
      if (!name) throw new HttpError(400, `Item #${i + 1} needs a name.`);
      const quantity = Number(it.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
        throw new HttpError(400, `Quantity for "${name}" must be a whole number of 1 or more.`);
      }
      const price = toCentavos(it.price, `Price of "${name}"`);
      if (price === 0) throw new HttpError(400, `Price of "${name}" must be more than 0.`);
      return { name, price, quantity };
    });
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

    let cashReceived = total;
    let change = 0;
    if (method === 'cash') {
      cashReceived = toCentavos(req.body.cashReceived, 'Cash received');
      if (cashReceived < total) {
        throw new HttpError(400, `Cash received is short by ₱${((total - cashReceived) / 100).toFixed(2)}.`);
      }
      change = cashReceived - total;
    }

    const saved = [];
    try {
      const photo = photoFile ? await savePhoto(photoFile) : null;
      if (photo) saved.push(photo._id);
      const proof = proofFile ? await savePhoto(proofFile) : null;
      if (proof) saved.push(proof._id);

      // Assign the next number for the day; retry if two sales race.
      for (let attempt = 0; attempt < 5; attempt++) {
        const last = await Transaction.findOne({ date }).sort({ number: -1 }).select('number');
        try {
          const t = await Transaction.create({
            date,
            number: last ? last.number + 1 : 1,
            category,
            method,
            items,
            total,
            cashReceived,
            change,
            reference: method === 'online' ? cleanText(req.body.reference, 60) : '',
            photo: photo ? photo._id : null,
            paymentProof: proof ? proof._id : null,
            cashier: req.user._id,
            cashierName: req.user.name,
          });
          const tx = serializeTransaction(t);
          // Cashiers get what they need to finish the sale, nothing more.
          const body =
            req.user.role === 'owner'
              ? tx
              : { number: tx.number, method, total: tx.total, cashReceived: tx.cashReceived, change: tx.change };
          return res.status(201).json({ transaction: body, day: await summaryFor(req.user, day) });
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
      }
      throw new HttpError(503, 'Could not save the sale, please try again.');
    } catch (err) {
      if (saved.length) await Photo.deleteMany({ _id: { $in: saved } });
      throw err;
    }
  })
);

// Cash in / cash out of the drawer (not a sale).
router.post(
  '/cash-movements',
  wrap(async (req, res) => {
    const day = await getOpenDay();
    const type = req.body.type === 'in' ? 'in' : req.body.type === 'out' ? 'out' : null;
    if (!type) throw new HttpError(400, 'Choose cash in or cash out.');
    const amount = toCentavos(req.body.amount, 'Amount');
    if (amount === 0) throw new HttpError(400, 'Amount must be more than 0.');
    const reason = cleanText(req.body.reason, 300);
    if (!reason) throw new HttpError(400, 'Please enter a reason.');
    if (type === 'out') {
      const inDrawer = expectedCashOf(day, await dayTotals(day.date));
      if (amount > inDrawer) {
        throw new HttpError(400, `There is only ₱${(inDrawer / 100).toFixed(2)} in the drawer.`);
      }
    }
    const m = await CashMovement.create({ date: day.date, type, amount, reason, byName: req.user.name });
    res.status(201).json({ movement: serializeMovement(m), day: await summaryFor(req.user, day) });
  })
);

module.exports = { router, upload, savePhoto };
