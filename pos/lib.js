const { Transaction, Refund, CashMovement } = require('./models');

const TIMEZONE = process.env.TIMEZONE || 'Asia/Manila';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wraps an async route so thrown errors reach the error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Today's date (YYYY-MM-DD) in the store's time zone.
function todayString(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Pesos (number or string) -> integer centavos. Throws on bad input.
function toCentavos(value, label) {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (value === '' || typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100_000_000) {
    throw new HttpError(400, `${label} must be a valid amount.`);
  }
  return Math.round(n * 100);
}

const toPesos = (c) => (c == null ? null : c / 100);
const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const cleanText = (v, max) => String(v ?? '').trim().slice(0, max);

// Totals for one day, in centavos.
async function dayTotals(date) {
  const [sales, refunds, moves] = await Promise.all([
    Transaction.aggregate([
      { $match: { date } },
      {
        // Older records (from before these fields existed) default to a cash clothing sale.
        $project: {
          total: 1,
          change: 1,
          ok: { $eq: [{ $ifNull: ['$voided.at', null] }, null] },
          category: { $ifNull: ['$category', 'clothing'] },
          method: { $ifNull: ['$method', 'cash'] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: { $cond: ['$ok', 1, 0] } },
          voidedCount: { $sum: { $cond: ['$ok', 0, 1] } },
          ...sumWhere('total', '$ok', 'sales'),
          ...sumWhere('total', { $and: ['$ok', { $eq: ['$method', 'cash'] }] }, 'cashSales'),
          ...sumWhere('total', { $and: ['$ok', { $eq: ['$method', 'online'] }] }, 'onlineSales'),
          ...sumWhere('total', { $and: ['$ok', { $eq: ['$category', 'clothing'] }] }, 'clothingSales'),
          ...sumWhere('total', { $and: ['$ok', { $eq: ['$category', 'other'] }] }, 'otherSales'),
          ...sumWhere('change', '$ok', 'changeGiven'),
        },
      },
    ]),
    Refund.aggregate([
      { $match: { date } },
      {
        $group: {
          _id: null,
          refunds: { $sum: '$amount' },
          cashRefunds: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
          refundCount: { $sum: 1 },
        },
      },
    ]),
    CashMovement.aggregate([
      { $match: { date } },
      {
        $group: {
          _id: null,
          cashIn: { $sum: { $cond: [{ $eq: ['$type', 'in'] }, '$amount', 0] } },
          cashOut: { $sum: { $cond: [{ $eq: ['$type', 'out'] }, '$amount', 0] } },
        },
      },
    ]),
  ]);
  return {
    count: 0, voidedCount: 0, sales: 0, cashSales: 0, onlineSales: 0, clothingSales: 0, otherSales: 0,
    changeGiven: 0, refunds: 0, cashRefunds: 0, refundCount: 0, cashIn: 0, cashOut: 0,
    ...strip(sales[0]), ...strip(refunds[0]), ...strip(moves[0]),
  };
}

function sumWhere(field, cond, as) {
  return { [as]: { $sum: { $cond: [cond, `$${field}`, 0] } } };
}
function strip(o) {
  if (!o) return {};
  const { _id, ...rest } = o;
  return rest;
}

// Cash that should be in the drawer right now (centavos).
function expectedCashOf(day, t) {
  return day.startingCash + t.cashSales - t.cashRefunds + t.cashIn - t.cashOut;
}

// Full day summary (owner view).
async function summarizeDay(day) {
  const t = await dayTotals(day.date);
  const expected = expectedCashOf(day, t);
  return {
    date: day.date,
    startingCash: toPesos(day.startingCash),
    transactionCount: t.count,
    voidedCount: t.voidedCount,
    totalSales: toPesos(t.sales),
    cashSales: toPesos(t.cashSales),
    onlineSales: toPesos(t.onlineSales),
    clothingSales: toPesos(t.clothingSales),
    otherSales: toPesos(t.otherSales),
    changeGiven: toPesos(t.changeGiven),
    refunds: toPesos(t.refunds),
    cashRefunds: toPesos(t.cashRefunds),
    refundCount: t.refundCount,
    cashIn: toPesos(t.cashIn),
    cashOut: toPesos(t.cashOut),
    netSales: toPesos(t.sales - t.refunds),
    expectedCash: toPesos(expected),
    countedCash: toPesos(day.countedCash),
    difference: day.countedCash == null ? null : toPesos(day.countedCash - expected),
    openedAt: day.openedAt,
    openedBy: day.openedBy,
    closedAt: day.closedAt,
    closedBy: day.closedBy,
    isClosed: !!day.closedAt,
    notes: day.notes,
  };
}

// What a cashier is allowed to see.
function cashierView(s) {
  return {
    date: s.date,
    startingCash: s.startingCash,
    expectedCash: s.expectedCash,
    transactionCount: s.transactionCount,
    isClosed: s.isClosed,
    closedAt: s.closedAt,
  };
}

function serializeTransaction(t) {
  return {
    id: t._id,
    number: t.number,
    date: t.date,
    category: t.category || 'clothing',
    method: t.method || 'cash',
    items: t.items.map((i) => ({
      name: i.name,
      price: toPesos(i.price),
      quantity: i.quantity,
      subtotal: toPesos(i.price * i.quantity),
    })),
    total: toPesos(t.total),
    cashReceived: toPesos(t.cashReceived),
    change: toPesos(t.change),
    reference: t.reference,
    photoUrl: t.photo ? `/api/photos/${t.photo}` : null,
    proofUrl: t.paymentProof ? `/api/photos/${t.paymentProof}` : null,
    cashierName: t.cashierName,
    voided: t.voided && t.voided.at ? { at: t.voided.at, byName: t.voided.byName, reason: t.voided.reason } : null,
    refundedTotal: toPesos(t.refundedTotal || 0),
    createdAt: t.createdAt,
  };
}

function serializeRefund(r) {
  return {
    id: r._id,
    date: r.date,
    transactionId: r.transaction,
    transactionDate: r.transactionDate,
    transactionNumber: r.transactionNumber,
    category: r.category,
    amount: toPesos(r.amount),
    method: r.method,
    reason: r.reason,
    photoUrl: `/api/photos/${r.photo}`,
    byName: r.byName,
    createdAt: r.createdAt,
  };
}

function serializeMovement(m) {
  return {
    id: m._id,
    date: m.date,
    type: m.type,
    amount: toPesos(m.amount),
    reason: m.reason,
    byName: m.byName,
    createdAt: m.createdAt,
  };
}

module.exports = {
  TIMEZONE,
  HttpError,
  wrap,
  todayString,
  toCentavos,
  toPesos,
  isValidDate,
  cleanText,
  dayTotals,
  expectedCashOf,
  summarizeDay,
  cashierView,
  serializeTransaction,
  serializeRefund,
  serializeMovement,
};
