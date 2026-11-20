// Owner-only routes: transactions, cancel (void), refunds, history, reports, export, photos.
const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { Day, Transaction, Refund, CashMovement, Photo } = require('../models');
const { requireOwner } = require('../auth');
const { upload, savePhoto } = require('./register');
const {
  HttpError, wrap, todayString, toCentavos, toPesos, isValidDate, cleanText,
  summarizeDay, serializeTransaction, serializeRefund, serializeMovement, dayTotals, expectedCashOf,
} = require('../lib');

const router = express.Router();
router.use(requireOwner);

async function findTransaction(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Sale not found.');
  const t = await Transaction.findById(id);
  if (!t) throw new HttpError(404, 'Sale not found.');
  return t;
}

// Everything that happened on one day.
router.get(
  '/transactions',
  wrap(async (req, res) => {
    const date = req.query.date || todayString();
    if (!isValidDate(date)) throw new HttpError(400, 'Date must look like YYYY-MM-DD.');
    const [day, txns, refunds, moves] = await Promise.all([
      Day.findOne({ date }),
      Transaction.find({ date }).sort({ number: -1 }),
      Refund.find({ date }).sort({ createdAt: -1 }),
      CashMovement.find({ date }).sort({ createdAt: -1 }),
    ]);
    res.json({
      date,
      isToday: date === todayString(),
      day: day ? await summarizeDay(day) : null,
      transactions: txns.map(serializeTransaction),
      refunds: refunds.map(serializeRefund),
      cashMovements: moves.map(serializeMovement),
    });
  })
);

// Cancel a sale that was entered by mistake. Only today's sales while the
// register is open, so a closed day's count never changes afterwards.
router.post(
  '/transactions/:id/void',
  wrap(async (req, res) => {
    const reason = cleanText(req.body.reason, 300);
    if (!reason) throw new HttpError(400, 'Please enter the reason for cancelling.');
    const t = await findTransaction(req.params.id);
    if (t.date !== todayString()) throw new HttpError(400, "Only today's sales can be cancelled. Use a refund instead.");
    const day = await Day.findOne({ date: t.date });
    if (!day || day.closedAt) throw new HttpError(400, 'Reopen the register before cancelling a sale.');
    if (t.voided.at) throw new HttpError(409, 'This sale is already cancelled.');
    if ((t.refundedTotal || 0) > 0) throw new HttpError(409, 'This sale already has a refund and cannot be cancelled.');
    if (t.method === 'cash') {
      const inDrawer = expectedCashOf(day, await dayTotals(day.date));
      if (t.total > inDrawer) throw new HttpError(400, 'Not enough cash in the drawer to cancel this sale.');
    }
    t.voided = { at: new Date(), byName: req.user.name, reason };
    await t.save();
    res.json({ transaction: serializeTransaction(t), day: await summarizeDay(day) });
  })
);

// Pay money back for an earlier sale (any day). Recorded on today's register.
router.post(
  '/transactions/:id/refund',
  upload.single('photo'),
  wrap(async (req, res) => {
    const today = await Day.findOne({ date: todayString() });
    if (!today || today.closedAt) throw new HttpError(400, "Today's register must be open to record a refund.");
    const t = await findTransaction(req.params.id);
    if (t.voided.at) throw new HttpError(409, 'This sale was cancelled; it cannot be refunded.');
    const amount = toCentavos(req.body.amount, 'Refund amount');
    if (amount === 0) throw new HttpError(400, 'Refund amount must be more than 0.');
    const method = req.body.method === 'online' ? 'online' : req.body.method === 'cash' ? 'cash' : null;
    if (!method) throw new HttpError(400, 'Choose how the money was returned (cash or online).');
    const reason = cleanText(req.body.reason, 300);
    if (!reason) throw new HttpError(400, 'Please enter the reason for the refund.');
    if (!req.file) throw new HttpError(400, 'A photo is required for a refund (e.g. the returned item or the transfer).');
    const refundable = t.total - (t.refundedTotal || 0);
    if (amount > refundable) throw new HttpError(400, `At most ₱${(refundable / 100).toFixed(2)} can be refunded for this sale.`);
    if (method === 'cash') {
      const inDrawer = expectedCashOf(today, await dayTotals(today.date));
      if (amount > inDrawer) throw new HttpError(400, `There is only ₱${(inDrawer / 100).toFixed(2)} in the drawer.`);
    }

    // Reserve the amount atomically so two refunds can't exceed the sale total.
    const updated = await Transaction.findOneAndUpdate(
      { _id: t._id, 'voided.at': null, $expr: { $lte: [{ $add: [{ $ifNull: ['$refundedTotal', 0] }, amount] }, '$total'] } },
      { $inc: { refundedTotal: amount } },
      { new: true }
    );
    if (!updated) throw new HttpError(409, 'This sale changed meanwhile; please try again.');

    let photo;
    try {
      photo = await savePhoto(req.file);
      const r = await Refund.create({
        date: today.date,
        transaction: t._id,
        transactionDate: t.date,
        transactionNumber: t.number,
        category: t.category,
        amount,
        method,
        reason,
        photo: photo._id,
        byName: req.user.name,
      });
      res.status(201).json({ refund: serializeRefund(r), transaction: serializeTransaction(updated), day: await summarizeDay(today) });
    } catch (err) {
      await Transaction.updateOne({ _id: t._id }, { $inc: { refundedTotal: -amount } });
      if (photo) await Photo.deleteOne({ _id: photo._id });
      throw err;
    }
  })
);

// Recent days with their summaries (newest first).
router.get(
  '/days',
  wrap(async (req, res) => {
    const days = await Day.find().sort({ date: -1 }).limit(120);
    res.json(await Promise.all(days.map(summarizeDay)));
  })
);

// ---------- reports ----------
const DAY_MS = 86400000;
const parseDate = (s) => new Date(s + 'T00:00:00Z');
const fmtDate = (d) => d.toISOString().slice(0, 10);

function bucketKey(dateStr, group) {
  if (group === 'month') return dateStr.slice(0, 7);
  if (group === 'week') {
    const d = parseDate(dateStr);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS);
    return fmtDate(monday);
  }
  return dateStr;
}

router.get(
  '/reports',
  wrap(async (req, res) => {
    const { from, to } = req.query;
    const group = ['day', 'week', 'month'].includes(req.query.group) ? req.query.group : 'day';
    if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'Choose a valid date range.');
    if (from > to) throw new HttpError(400, 'The start date must be before the end date.');
    if ((parseDate(to) - parseDate(from)) / DAY_MS > 3 * 366) throw new HttpError(400, 'Choose a range of 3 years or less.');

    const buckets = new Map();
    const blank = () => ({
      count: 0, clothing: 0, other: 0, cash: 0, online: 0, refunds: 0, cashIn: 0, cashOut: 0,
    });
    for (let d = parseDate(from); d <= parseDate(to); d = new Date(d.getTime() + DAY_MS)) {
      const k = bucketKey(fmtDate(d), group);
      if (!buckets.has(k)) buckets.set(k, blank());
    }

    const range = { date: { $gte: from, $lte: to } };
    const [txns, refunds, moves] = await Promise.all([
      Transaction.find({ ...range, 'voided.at': null }).select('date category method total').lean(),
      Refund.find(range).select('date amount').lean(),
      CashMovement.find(range).select('date type amount').lean(),
    ]);
    for (const t of txns) {
      const b = buckets.get(bucketKey(t.date, group));
      b.count += 1;
      b[t.category || 'clothing'] += t.total;
      b[t.method || 'cash'] += t.total;
    }
    for (const r of refunds) buckets.get(bucketKey(r.date, group)).refunds += r.amount;
    for (const m of moves) buckets.get(bucketKey(m.date, group))[m.type === 'in' ? 'cashIn' : 'cashOut'] += m.amount;

    const toRow = (key, b) => ({
      key,
      count: b.count,
      clothing: toPesos(b.clothing),
      other: toPesos(b.other),
      total: toPesos(b.clothing + b.other),
      cash: toPesos(b.cash),
      online: toPesos(b.online),
      refunds: toPesos(b.refunds),
      net: toPesos(b.clothing + b.other - b.refunds),
      cashIn: toPesos(b.cashIn),
      cashOut: toPesos(b.cashOut),
    });
    const totals = blank();
    for (const b of buckets.values()) for (const k in totals) totals[k] += b[k];
    res.json({
      from, to, group,
      rows: [...buckets.entries()].map(([k, b]) => toRow(k, b)),
      totals: toRow('total', totals),
    });
  })
);

// ---------- Excel export ----------
const PESO_FMT = '"₱"#,##0.00';
const CATEGORY = { clothing: 'Clothing', other: 'Other sales' };
const METHOD = { cash: 'Cash', online: 'Online' };

function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 14, style: c.money ? { numFmt: PESO_FMT } : {} }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r) => ws.addRow(r));
  return ws;
}

const timeOf = (d) =>
  new Date(d).toLocaleTimeString('en-PH', { timeZone: process.env.TIMEZONE || 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

router.get(
  '/export',
  wrap(async (req, res) => {
    let range;
    let label;
    if (req.query.date) {
      if (!isValidDate(req.query.date)) throw new HttpError(400, 'Date must look like YYYY-MM-DD.');
      range = { $gte: req.query.date, $lte: req.query.date };
      label = req.query.date;
    } else if (/^\d{4}-\d{2}$/.test(req.query.month || '')) {
      range = { $gte: `${req.query.month}-01`, $lte: `${req.query.month}-31` };
      label = req.query.month;
    } else {
      throw new HttpError(400, 'Choose a day or a month to export.');
    }

    const [days, txns, refunds, moves] = await Promise.all([
      Day.find({ date: range }).sort({ date: 1 }),
      Transaction.find({ date: range }).sort({ date: 1, number: 1 }).lean(),
      Refund.find({ date: range }).sort({ createdAt: 1 }).lean(),
      CashMovement.find({ date: range }).sort({ createdAt: 1 }).lean(),
    ]);
    const summaries = await Promise.all(days.map(summarizeDay));

    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    addSheet(
      wb,
      'Daily summary',
      [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Sales (count)', key: 'transactionCount' },
        { header: 'Clothing', key: 'clothingSales', money: true },
        { header: 'Other sales', key: 'otherSales', money: true },
        { header: 'Total sales', key: 'totalSales', money: true },
        { header: 'Cash sales', key: 'cashSales', money: true },
        { header: 'Online sales', key: 'onlineSales', money: true },
        { header: 'Refunds', key: 'refunds', money: true },
        { header: 'Net sales', key: 'netSales', money: true },
        { header: 'Starting cash', key: 'startingCash', money: true },
        { header: 'Cash in', key: 'cashIn', money: true },
        { header: 'Cash out', key: 'cashOut', money: true },
        { header: 'Expected cash', key: 'expectedCash', money: true },
        { header: 'Counted cash', key: 'countedCash', money: true },
        { header: 'Difference', key: 'difference', money: true },
        { header: 'Cancelled sales', key: 'voidedCount' },
        { header: 'Opened by', key: 'openedBy' },
        { header: 'Closed by', key: 'closedBy' },
        { header: 'Notes', key: 'notes', width: 30 },
      ],
      summaries
    );

    addSheet(
      wb,
      'Sales',
      [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'No.', key: 'number', width: 6 },
        { header: 'Time', key: 'time', width: 10 },
        { header: 'Type', key: 'category', width: 12 },
        { header: 'Items', key: 'items', width: 40 },
        { header: 'Total', key: 'total', money: true },
        { header: 'Payment', key: 'method', width: 10 },
        { header: 'Reference no.', key: 'reference', width: 16 },
        { header: 'Cash received', key: 'cashReceived', money: true },
        { header: 'Change', key: 'change', money: true },
        { header: 'Refunded', key: 'refunded', money: true },
        { header: 'Cashier', key: 'cashierName' },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Cancel reason', key: 'voidReason', width: 30 },
      ],
      txns.map((t) => ({
        date: t.date,
        number: t.number,
        time: timeOf(t.createdAt),
        category: CATEGORY[t.category || 'clothing'],
        items: t.items.map((i) => `${i.name} ×${i.quantity} @ ₱${(i.price / 100).toFixed(2)}`).join('; '),
        total: toPesos(t.total),
        method: METHOD[t.method || 'cash'],
        reference: t.reference || '',
        cashReceived: t.method === 'online' ? null : toPesos(t.cashReceived),
        change: t.method === 'online' ? null : toPesos(t.change),
        refunded: toPesos(t.refundedTotal || 0),
        cashierName: t.cashierName || '',
        status: t.voided && t.voided.at ? 'Cancelled' : 'OK',
        voidReason: (t.voided && t.voided.reason) || '',
      }))
    );

    addSheet(
      wb,
      'Refunds',
      [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Time', key: 'time', width: 10 },
        { header: 'For sale', key: 'sale', width: 18 },
        { header: 'Type', key: 'category', width: 12 },
        { header: 'Amount', key: 'amount', money: true },
        { header: 'Paid back by', key: 'method' },
        { header: 'Reason', key: 'reason', width: 40 },
        { header: 'Recorded by', key: 'byName' },
      ],
      refunds.map((r) => ({
        date: r.date,
        time: timeOf(r.createdAt),
        sale: `${r.transactionDate} #${r.transactionNumber}`,
        category: CATEGORY[r.category],
        amount: toPesos(r.amount),
        method: METHOD[r.method],
        reason: r.reason,
        byName: r.byName,
      }))
    );

    addSheet(
      wb,
      'Cash in-out',
      [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Time', key: 'time', width: 10 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Amount', key: 'amount', money: true },
        { header: 'Reason', key: 'reason', width: 40 },
        { header: 'By', key: 'byName' },
      ],
      moves.map((m) => ({
        date: m.date,
        time: timeOf(m.createdAt),
        type: m.type === 'in' ? 'Cash in' : 'Cash out',
        amount: toPesos(m.amount),
        reason: m.reason,
        byName: m.byName,
      }))
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sales-${label}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  })
);

// ---------- photos ----------
router.get(
  '/photos/:id',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Photo not found.');
    const photo = await Photo.findById(req.params.id);
    if (!photo) throw new HttpError(404, 'Photo not found.');
    res.set('Content-Type', photo.contentType);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(photo.data);
  })
);

module.exports = { router };
