import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import {
  authBootstrapLimiter,
  authLoginLimiter,
  authRefreshLimiter,
  authRegisterLimiter,
} from '../middleware/rateLimitAuth.js';
import { createSessionForUser, hashRefreshToken } from '../utils/sessionTokens.js';

const router = Router();

function userResponse(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

router.post('/register', authRegisterLimiter, async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }
    const allowedOnRegister = ['customer', 'logistics_manager'];
    const r = allowedOnRegister.includes(role) ? role : 'customer';
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role: r });
    const { accessToken, refreshToken } = await createSessionForUser(user);
    res.status(201).json({
      accessToken,
      refreshToken,
      user: userResponse(user),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/bootstrap-admin', authBootstrapLimiter, async (req, res, next) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount > 0) {
      return res.status(403).json({ message: 'Admin already exists' });
    }
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hash,
      role: 'admin',
    });
    const { accessToken, refreshToken } = await createSessionForUser(user);
    res.status(201).json({
      accessToken,
      refreshToken,
      user: userResponse(user),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/login', authLoginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password required' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const { accessToken, refreshToken } = await createSessionForUser(user);
    res.json({
      accessToken,
      refreshToken,
      user: userResponse(user),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/refresh', authRefreshLimiter, async (req, res, next) => {
  try {
    const raw = String(req.body.refreshToken || '').trim();
    if (!raw) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }
    const tokenHash = hashRefreshToken(raw);
    const doc = await RefreshToken.findOne({ tokenHash });
    if (!doc || doc.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    await RefreshToken.deleteOne({ _id: doc._id });
    const user = await User.findById(doc.userId);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }
    const { accessToken, refreshToken } = await createSessionForUser(user);
    res.json({ accessToken, refreshToken });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const raw = String(req.body.refreshToken || '').trim();
    if (raw) {
      await RefreshToken.deleteMany({ tokenHash: hashRefreshToken(raw) });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
