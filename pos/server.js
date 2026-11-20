require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { HttpError, TIMEZONE } = require('./lib');
const auth = require('./auth');
const register = require('./routes/register');
const owner = require('./routes/owner');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos';
const STORE_NAME = process.env.STORE_NAME || 'BonAmi POS';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});
app.get('/api/info', (req, res) => res.json({ storeName: STORE_NAME, timezone: TIMEZONE }));

app.use('/api', auth.loadUser);
app.use('/api/auth', auth.router);
app.use('/api/users', auth.usersRouter);
app.use('/api', register.router);
app.use('/api', owner.router);

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
