import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './lib/prisma.js';
import { authMiddleware, requireActiveAccount } from './middleware/auth.js';
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
import billingRoutes from './routes/billing.js';
import platformRoutes from './routes/platform.js';
import performanceRoutes from './routes/performance.js';
import exportsRoutes from './routes/exports.js';
import { handleAgentFloatDelivery } from './routes/integrations.js';
import { handleDirectPayWebhook } from './routes/directpay-webhook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

const agentFloatIngest = [
  express.raw({ type: 'application/json', limit: '50mb' }),
  handleAgentFloatDelivery
];

// biReports default URL path + Field-Pro canonical path
app.post('/api/agent-float', ...agentFloatIngest);
app.post('/api/integrations/agent-float', ...agentFloatIngest);

// DirectPay / EasyPay subscription webhook (raw body for HMAC verification)
app.post(
  '/api/webhooks/directpay',
  express.raw({ type: 'application/json', limit: '5mb' }),
  handleDirectPayWebhook
);

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'field-pro-api', database: 'connected' });
  } catch {
    res.status(503).json({
      ok: false,
      service: 'field-pro-api',
      database: 'unavailable',
      hint: 'Run Backend/scripts/setup-local-db.ps1 with your postgres admin password'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', registerRoutes);

app.use('/api', authMiddleware, loadUser, requireActiveAccount);

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
app.use('/api', dataRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'PrismaClientInitializationError') {
    return res.status(503).json({
      error:
        'Database unavailable. Create the fieldpro database — see README (Local PostgreSQL setup).'
    });
  }
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await prisma.$connect();
    console.log('Database connected');
  } catch (err) {
    console.error('\nDatabase connection failed:', err.message);
    console.error('\nLocal PostgreSQL setup (run once):');
    console.error(
      '  .\\scripts\\setup-local-db.ps1 -PostgresPassword YOUR_POSTGRES_ADMIN_PASSWORD'
    );
    console.error(
      '\nOr update DATABASE_URL in Backend/.env to match your PostgreSQL credentials.\n'
    );
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Field-Pro API running on http://localhost:${PORT}`);
  });

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
