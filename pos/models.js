const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// All money is stored as integer centavos to avoid floating point errors
// (e.g. ₱890.50 is stored as 89050).

// People who can log in. "owner" can do everything; "cashier" can only sell,
// add/remove drawer cash and open/close the register.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    nameKey: { type: String, required: true, unique: true }, // lower-case name for lookups
    role: { type: String, enum: ['owner', 'cashier'], required: true },
    pinHash: { type: String, required: true },
    pinSalt: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Logged-in sessions. Only a hash of the cookie token is stored.
const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
});
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// One business day of the register.
const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD (store's local date)
    startingCash: { type: Number, required: true, min: 0 },
    openedAt: { type: Date, default: Date.now },
    openedBy: { type: String, default: '' },
    closedAt: { type: Date, default: null },
    closedBy: { type: String, default: '' },
    countedCash: { type: Number, default: null }, // actual cash counted at closing
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    price: { type: Number, required: true, min: 0 }, // per unit
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

// A single customer sale.
const transactionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // links to Day.date
    number: { type: Number, required: true }, // 1, 2, 3 ... within the day
    category: { type: String, enum: ['clothing', 'other'], default: 'clothing' },
    method: { type: String, enum: ['cash', 'online'], default: 'cash' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true, min: 0 },
    cashReceived: { type: Number, required: true, min: 0 }, // equals total for online payments
    change: { type: Number, required: true, min: 0 },
    reference: { type: String, default: '' }, // online payment reference number
    photo: { type: ObjectId, ref: 'Photo', default: null }, // product photo
    paymentProof: { type: ObjectId, ref: 'Photo', default: null }, // screenshot of online payment
    cashier: { type: ObjectId, ref: 'User', default: null },
    cashierName: { type: String, default: '' },
    voided: {
      at: { type: Date, default: null },
      byName: { type: String, default: '' },
      reason: { type: String, default: '' },
    },
    refundedTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);
transactionSchema.index({ date: 1, number: 1 }, { unique: true });

// Money paid back to a customer for an earlier sale. Recorded on the day the
// money left the store (which can be later than the sale itself).
const refundSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true },
    transaction: { type: ObjectId, ref: 'Transaction', required: true },
    transactionDate: { type: String, required: true },
    transactionNumber: { type: Number, required: true },
    category: { type: String, enum: ['clothing', 'other'], required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['cash', 'online'], required: true },
    reason: { type: String, required: true, maxlength: 300 },
    photo: { type: ObjectId, ref: 'Photo', required: true },
    byName: { type: String, default: '' },
  },
  { timestamps: true }
);

// Cash added to or taken out of the drawer that is not a sale
// (e.g. adding coins for change, paying for an expense, moving cash to the safe).
const cashMovementSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true },
    type: { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, maxlength: 300 },
    byName: { type: String, default: '' },
  },
  { timestamps: true }
);

// Photos (products, payment proofs, refunds), stored inside MongoDB so the
// app works the same on MongoDB Atlas. Images are resized in the browser first.
const photoSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model('User', userSchema),
  Session: mongoose.model('Session', sessionSchema),
  Day: mongoose.model('Day', daySchema),
  Transaction: mongoose.model('Transaction', transactionSchema),
  Refund: mongoose.model('Refund', refundSchema),
  CashMovement: mongoose.model('CashMovement', cashMovementSchema),
  Photo: mongoose.model('Photo', photoSchema),
};
