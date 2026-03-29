import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/** Verify Bearer / Socket auth JWT; returns null if missing or invalid. */
export function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token.trim(), process.env.JWT_SECRET);
    if (payload.kind != null && payload.kind !== 'access') return null;
    const sub = payload.sub;
    const role = payload.role;
    if (!sub || !role) return null;
    return { userId: String(sub), role: String(role) };
  } catch {
    return null;
  }
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const session = verifyAccessToken(token);
  if (!session) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.userId = session.userId;
  req.userRole = session.role;
  next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

/** Attach full user doc when needed */
export async function attachUser(req, res, next) {
  try {
    req.user = await User.findById(req.userId).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch (e) {
    next(e);
  }
}
