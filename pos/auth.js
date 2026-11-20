const crypto = require('crypto');
const express = require('express');
const { User, Session } = require('./models');
const { HttpError, wrap, cleanText } = require('./lib');

const COOKIE = 'pos_session';
const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 12;
const SECURE_COOKIE = process.env.SECURE_COOKIE === 'true';

// ---------- PIN hashing ----------
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return { pinHash: hash, pinSalt: salt };
}
function verifyPin(user, pin) {
  const { pinHash } = hashPin(pin, user.pinSalt);
  return crypto.timingSafeEqual(Buffer.from(pinHash, 'hex'), Buffer.from(user.pinHash, 'hex'));
}
function validatePin(pin) {
  if (!/^\d{4,8}$/.test(String(pin ?? ''))) throw new HttpError(400, 'PIN must be 4 to 8 digits.');
  return String(pin);
}
function validateName(name) {
  const n = cleanText(name, 40);
  if (!n) throw new HttpError(400, 'Name is required.');
  return n;
}

// ---------- brute-force protection ----------
// After 5 wrong PINs for a name, that name is locked for 5 minutes.
const failures = new Map();
function checkLock(key) {
  const f = failures.get(key);
  if (f && f.lockedUntil > Date.now()) {
    const mins = Math.ceil((f.lockedUntil - Date.now()) / 60000);
    throw new HttpError(429, `Too many wrong PINs. Try again in ${mins} minute(s).`);
  }
}
function recordFailure(key) {
  const f = failures.get(key) || { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= 5) {
    f.count = 0;
    f.lockedUntil = Date.now() + 5 * 60 * 1000;
  }
  failures.set(key, f);
}

// ---------- sessions ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function startSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  await Session.create({
    tokenHash: sha256(token),
    user: user._id,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000),
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: SECURE_COOKIE,
    maxAge: SESSION_HOURS * 3600 * 1000,
    path: '/',
  });
}

// Attaches req.user when a valid session cookie is present.
const loadUser = wrap(async (req, res, next) => {
  const token = readCookie(req, COOKIE);
  if (token) {
    const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).populate('user');
    if (session && session.user && session.user.active) {
      req.user = session.user;
      req.sessionId = session._id;
    }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please log in.'));
  next();
}
function requireOwner(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please log in.'));
  if (req.user.role !== 'owner') return next(new HttpError(403, 'Only the owner can do this.'));
  next();
}

const publicUser = (u) => ({ id: u._id, name: u.name, role: u.role, active: u.active });

// ---------- routes ----------
const router = express.Router();

router.get(
  '/status',
  wrap(async (req, res) => {
    const setupNeeded = (await User.countDocuments()) === 0;
    res.json({ setupNeeded, user: req.user ? publicUser(req.user) : null });
  })
);

// First run only: create the owner account.
router.post(
  '/setup',
  wrap(async (req, res) => {
    if ((await User.countDocuments()) > 0) throw new HttpError(409, 'The owner account already exists.');
    const name = validateName(req.body.name);
    const pin = validatePin(req.body.pin);
    const user = await User.create({ name, nameKey: name.toLowerCase(), role: 'owner', ...hashPin(pin) });
    await startSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  })
);

// Names shown on the login screen.
router.get(
  '/users',
  wrap(async (req, res) => {
    const users = await User.find({ active: true }).sort({ role: -1, name: 1 });
    res.json(users.map((u) => ({ name: u.name, role: u.role })));
  })
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const key = cleanText(req.body.name, 40).toLowerCase();
    checkLock(key);
    const user = await User.findOne({ nameKey: key, active: true });
    if (!user || !verifyPin(user, String(req.body.pin ?? ''))) {
      recordFailure(key);
      throw new HttpError(401, 'Wrong name or PIN.');
    }
    failures.delete(key);
    await startSession(res, user);
    res.json({ user: publicUser(user) });
  })
);

router.post(
  '/logout',
  wrap(async (req, res) => {
    const token = readCookie(req, COOKIE);
    if (token) await Session.deleteOne({ tokenHash: sha256(token) });
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  })
);

// ---------- user management (owner) ----------
const usersRouter = express.Router();
usersRouter.use(requireOwner);

usersRouter.get(
  '/',
  wrap(async (req, res) => {
    const users = await User.find().sort({ role: -1, name: 1 });
    res.json(users.map(publicUser));
  })
);

usersRouter.post(
  '/',
  wrap(async (req, res) => {
    const name = validateName(req.body.name);
    const role = req.body.role === 'owner' ? 'owner' : 'cashier';
    const pin = validatePin(req.body.pin);
    if (await User.exists({ nameKey: name.toLowerCase() })) throw new HttpError(409, 'Someone already has that name.');
    const user = await User.create({ name, nameKey: name.toLowerCase(), role, ...hashPin(pin) });
    res.status(201).json(publicUser(user));
  })
);

usersRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const user = await User.findById(req.params.id).catch(() => null);
    if (!user) throw new HttpError(404, 'User not found.');
    if (req.body.name !== undefined) {
      const name = validateName(req.body.name);
      const clash = await User.findOne({ nameKey: name.toLowerCase(), _id: { $ne: user._id } });
      if (clash) throw new HttpError(409, 'Someone already has that name.');
      user.name = name;
      user.nameKey = name.toLowerCase();
    }
    if (req.body.pin !== undefined && req.body.pin !== '') {
      Object.assign(user, hashPin(validatePin(req.body.pin)));
      // log them out on other devices (but keep this session)
      await Session.deleteMany({ user: user._id, _id: { $ne: req.sessionId || null } });
    }
    if (req.body.active !== undefined) {
      const active = !!req.body.active;
      if (!active && user._id.equals(req.user._id)) throw new HttpError(400, 'You cannot turn off your own account.');
      if (!active && user.role === 'owner') {
        const owners = await User.countDocuments({ role: 'owner', active: true });
        if (owners <= 1) throw new HttpError(400, 'There must be at least one active owner.');
      }
      user.active = active;
      if (!active) await Session.deleteMany({ user: user._id });
    }
    await user.save();
    res.json(publicUser(user));
  })
);

module.exports = { router, usersRouter, loadUser, requireAuth, requireOwner };
