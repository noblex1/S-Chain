import rateLimit from 'express-rate-limit';

function numEnv(key, fallback) {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Login: tight cap per IP to slow credential stuffing */
export const authLoginLimiter = rateLimit({
  windowMs: numEnv('AUTH_LOGIN_WINDOW_MS', 15 * 60 * 1000),
  max: numEnv('AUTH_LOGIN_MAX', 5),
  message: { message: 'Too many login attempts from this address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/** Public registration: limit account spam */
export const authRegisterLimiter = rateLimit({
  windowMs: numEnv('AUTH_REGISTER_WINDOW_MS', 60 * 60 * 1000),
  max: numEnv('AUTH_REGISTER_MAX', 20),
  message: { message: 'Too many registration attempts from this address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Bootstrap admin: very rare operation */
export const authBootstrapLimiter = rateLimit({
  windowMs: numEnv('AUTH_BOOTSTRAP_WINDOW_MS', 60 * 60 * 1000),
  max: numEnv('AUTH_BOOTSTRAP_MAX', 3),
  message: { message: 'Too many bootstrap attempts from this address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Token refresh: moderate cap per IP */
export const authRefreshLimiter = rateLimit({
  windowMs: numEnv('AUTH_REFRESH_WINDOW_MS', 15 * 60 * 1000),
  max: numEnv('AUTH_REFRESH_MAX', 60),
  message: { message: 'Too many token refresh attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
