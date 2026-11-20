const mongoose = require('mongoose');

// All money is stored as integer centavos to avoid floating point errors
// (e.g. ₱890.50 is stored as 89050).

// One business day of the register.
const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD (store's local date)
    startingCash: { type: Number, required: true, min: 0 }, // centavos
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    countedCash: { type: Number, default: null }, // actual cash counted at closing, centavos
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    price: { type: Number, required: true, min: 0 }, // centavos per unit
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

// A single customer sale.
const transactionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // links to Day.date
    number: { type: Number, required: true }, // 1, 2, 3 ... within the day
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true, min: 0 }, // centavos
    cashReceived: { type: Number, required: true, min: 0 }, // centavos
    change: { type: Number, required: true, min: 0 }, // centavos
    photo: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo', required: true },
  },
  { timestamps: true }
);
transactionSchema.index({ date: 1, number: 1 }, { unique: true });

// Product photo kept as proof of each sale. Stored inside MongoDB so the app
// works the same on MongoDB Atlas (no local disk needed). Images are resized
// in the browser before upload, so they are small.
const photoSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = {
  Day: mongoose.model('Day', daySchema),
  Transaction: mongoose.model('Transaction', transactionSchema),
  Photo: mongoose.model('Photo', photoSchema),
};
