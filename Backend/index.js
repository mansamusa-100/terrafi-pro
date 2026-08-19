import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './lib/prisma.js';
import { ensurePlatformOwner } from './lib/ensure-platform-owner.js';
import {
  authMiddleware,
  requireActiveAccount,
  requireSubscriptionAccess
} from './middleware/auth.js';
import { loadUser } from './middleware/user.js';
import authRoutes from './routes/auth.js';
import agentsRoutes from './routes/agents.js';
import visitsRoutes from './routes/visits.js';
import companiesRoutes from './routes/companies.js';
import usersRoutes from './routes/users.js';
import registerRoutes from './routes/register.js';
import auditRoutes from './routes/audit.js';
import dataRoutes from './routes/data.js';
import kycRoutes from './routes/kyc.js';
import floatSyncRoutes from './routes/float-sync.js';
import settingsRoutes from './routes/settings.js';
import notificationsRoutes from './routes/notifications.js';
import notificationReportsRoutes from './routes/notification-reports.js';
import billingRoutes from './routes/billing.js';
import platformRoutes from './routes/platform.js';
import performanceRoutes from './routes/performance.js';
import exportsRoutes from './routes/exports.js';
import plansRoutes from './routes/plans.js';
import { handleAgentFloatDelivery } from './routes/integrations.js';
import { handleDirectPayWebhook } from './routes/directpay-webhook.js';
import { runSubscriptionLifecycleSweep } from './lib/subscription-lifecycle.js';
import {
  assertProductionSecrets,
  createRateLimiters,
  resolveCorsOrigin
} from './lib/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

assertProductionSecrets();

const app = express();

// Coolify / Traefik / Docker terminate TLS and forward client IP
app.set('trust proxy', Number(process.env.TRUST_PROXY || (isProd ? 1 : 0)));

app.use(
  helmet({
    // SPA may load same-origin assets; API also serves Frontend/dist in prod
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
          }
        }
      : false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin: resolveCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

const limits = createRateLimiters();

const floatBodyLimit = process.env.FLOAT_INGEST_BODY_LIMIT || '1mb';
const agentFloatIngest = [
  limits.floatIngest,
  express.raw({ type: 'application/json', limit: floatBodyLimit }),
  handleAgentFloatDelivery
];

// biReports default URL path + Field-Pro canonical path
app.post('/api/agent-float', ...agentFloatIngest);
app.post('/api/integrations/agent-float', ...agentFloatIngest);

// DirectPay / EasyPay subscription webhook (raw body for HMAC verification)
app.post(
  '/api/webhooks/directpay',
  limits.webhook,
  express.raw({
    type: 'application/json',
    limit: process.env.WEBHOOK_BODY_LIMIT || '256kb'
  }),
  handleDirectPayWebhook
);

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

// Uploads: rate-limit + no directory listing. Prefer branding; KYC paths are
// still guessable if leaked — keep paths unguessable and rotate secrets.
const uploadsRoot = path.join(__dirname, 'uploads');
app.use(
  '/uploads',
  limits.uploads,
  express.static(uploadsRoot, {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=300');
    }
  })
);

app.get('/api/health', limits.publicRead, async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'terrafi-pro-api', database: 'connected' });
  } catch {
    const body = {
      ok: false,
      service: 'terrafi-pro-api',
      database: 'unavailable'
    };
    if (!isProd) {
      body.hint =
        'Run Backend/scripts/setup-local-db.ps1 with your postgres admin password';
    }
    res.status(503).json(body);
  }
});

app.use('/api', limits.globalApi);

app.use('/api/auth/login', limits.login);
app.use('/api/auth/register-company', limits.register);
app.use('/api/plans', limits.publicRead);

app.use('/api/auth', authRoutes);
app.use('/api/auth', registerRoutes);
app.use('/api/plans', plansRoutes);

app.use(
  '/api',
  authMiddleware,
  loadUser,
  requireActiveAccount,
  requireSubscriptionAccess
);

app.use('/api/agents', agentsRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/float-sync', floatSyncRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/export', exportsRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/notification-reports', notificationReportsRoutes);
app.use('/api', dataRoutes);

if (isProd) {
  const frontendDist = path.join(__dirname, '../Frontend/dist');
  app.use(express.static(frontendDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use((err, _req, res, _next) => {
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  console.error(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err.name === 'PrismaClientInitializationError') {
    return res.status(503).json({
      error: isProd
        ? 'Database unavailable'
        : 'Database unavailable. Create the fieldpro database — see README (Local PostgreSQL setup).'
    });
  }
  res.status(500).json({ error: 'Internal server error' });
});

function ensureUploadDirs() {
  for (const dir of [
    'uploads/kyc',
    'uploads/locations',
    'uploads/location',
    'uploads/branding'
  ]) {
    fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
  }
}

async function start() {
  ensureUploadDirs();

  try {
    await prisma.$connect();
    console.log('Database connected');
    if (isProd) {
      await ensurePlatformOwner();
    }
  } catch (err) {
    console.error('\nDatabase connection failed:', err.message);
    if (!isProd) {
      console.error('\nLocal PostgreSQL setup (run once):');
      console.error(
        '  .\\scripts\\setup-local-db.ps1 -PostgresPassword YOUR_POSTGRES_ADMIN_PASSWORD'
      );
      console.error(
        '\nOr update DATABASE_URL in Backend/.env to match your PostgreSQL credentials.\n'
      );
    }
    process.exit(1);
  }

  const host = isProd ? '0.0.0.0' : undefined;
  const server = app.listen(PORT, host, () => {
    const where = isProd ? `port ${PORT}` : `http://localhost:${PORT}`;
    console.log(`Terrafi Pro running on ${where}`);
  });

  const sweepMs = Number(process.env.SUBSCRIPTION_SWEEP_MS || 60 * 60 * 1000);
  const runSweep = () =>
    runSubscriptionLifecycleSweep()
      .then((r) => {
        if (r.lockTransitions > 0) {
          console.info(
            `[subscription-lifecycle] scanned ${r.scanned}, transitions ${r.lockTransitions}`
          );
        }
      })
      .catch((err) => console.warn('[subscription-lifecycle]', err.message));
  setTimeout(runSweep, 15_000);
  setInterval(runSweep, sweepMs);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop the other process or run: netstat -ano | findstr :${PORT}`
      );
      process.exit(1);
    }
    throw err;
  });
}

start();
