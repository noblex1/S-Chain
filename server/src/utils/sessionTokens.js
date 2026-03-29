import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import RefreshToken from '../models/RefreshToken.js';

function accessExpires() {
  return process.env.ACCESS_TOKEN_EXPIRES || '15m';
}

function refreshDays() {
  const d = Number(process.env.REFRESH_TOKEN_DAYS);
  return Number.isFinite(d) && d > 0 ? d : 7;
}

export async function createSessionForUser(user) {
  const accessToken = jwt.sign(
    { sub: user._id.toString(), role: user.role, kind: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: accessExpires() }
  );
  const rawRefresh = crypto.randomBytes(48).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt = new Date(Date.now() + refreshDays() * 86400000);
  await RefreshToken.create({ userId: user._id, tokenHash, expiresAt });
  return { accessToken, refreshToken: rawRefresh };
}

export function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(String(raw).trim()).digest('hex');
}
