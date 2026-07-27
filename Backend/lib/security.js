import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

function boolEnv(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

export function createRateLimiters() {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);

  const standardHeaders = true;
  const legacyHeaders = false;
  const handler = (_req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please wait and try again.',
      code: 'RATE_LIMITED'
    });
  };

  return {
    /** Broad ceiling for all /api traffic */
    globalApi: rateLimit({
      windowMs,
      max: Number(process.env.RATE_LIMIT_API_MAX || 600),
      standardHeaders,
      legacyHeaders,
      handler
    }),

    /** Login brute-force protection */
    login: rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || 15 * 60 * 1000),
      max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 10),
      standardHeaders,
      legacyHeaders,
      handler,
      keyGenerator: (req) => {
        const email = String(req.body?.email || '')
          .trim()
          .toLowerCase()
          .slice(0, 120);
        return `${ipKeyGenerator(req.ip)}:${email || 'anon'}`;
      }
    }),

    /** Company registration spam */
    register: rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_REGISTER_WINDOW_MS || 60 * 60 * 1000),
      max: Number(process.env.RATE_LIMIT_REGISTER_MAX || 5),
      standardHeaders,
      legacyHeaders,
      handler
    }),

    /** Public catalogue / health */
    publicRead: rateLimit({
      windowMs: 60 * 1000,
      max: Number(process.env.RATE_LIMIT_PUBLIC_MAX || 60),
      standardHeaders,
      legacyHeaders,
      handler
    }),

    /** Partner float ingest */
    floatIngest: rateLimit({
      windowMs: 60 * 1000,
      max: Number(process.env.RATE_LIMIT_FLOAT_MAX || 120),
      standardHeaders,
      legacyHeaders,
      handler
    }),

    /** DirectPay webhooks (valid + invalid signature floods) */
    webhook: rateLimit({
      windowMs: 60 * 1000,
      max: Number(process.env.RATE_LIMIT_WEBHOOK_MAX || 180),
      standardHeaders,
      legacyHeaders,
      handler
    }),

    /** Uploaded file downloads */
    uploads: rateLimit({
      windowMs: 60 * 1000,
      max: Number(process.env.RATE_LIMIT_UPLOADS_MAX || 120),
      standardHeaders,
      legacyHeaders,
      handler
    })
  };
}

export function resolveCorsOrigin() {
  const raw = process.env.CORS_ORIGINS?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!raw) {
    // Local/dev: allow Vite + same-origin. Production: same-origin only (no *
    // reflection) unless CORS_ORIGINS is set.
    return isProd ? false : true;
  }

  if (raw === '*') {
    if (isProd && !boolEnv('CORS_ALLOW_STAR', false)) {
      console.warn(
        '[security] CORS_ORIGINS=* ignored in production; set explicit origins'
      );
      return false;
    }
    return true;
  }

  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (origin, callback) => {
    // Same-origin / non-browser requests have no Origin header
    if (!origin) return callback(null, true);
    if (list.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  };
}

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwt = process.env.JWT_SECRET?.trim() || '';
  if (
    !jwt ||
    jwt === 'field-pro-dev-secret' ||
    jwt === 'field-pro-dev-secret-change-in-production' ||
    jwt.length < 32
  ) {
    throw new Error(
      'JWT_SECRET must be set to a strong secret (min 32 chars) in production'
    );
  }
}

export { boolEnv };
