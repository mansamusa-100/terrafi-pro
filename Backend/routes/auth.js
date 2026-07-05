import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { loadUser, serializeAppUser } from '../middleware/user.js';
import { loadSupervisedAdrs } from '../lib/team-lead.js';
import { cachedCompanySubscription } from '../lib/company-billing.js';

const router = Router();

async function toAppUser(row) {
  const supervised =
    row.role === 'team_lead' ? await loadSupervisedAdrs(row.id) : null;
  return serializeAppUser(row, supervised);
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const row = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      include: { company: true }
    });

    if (!row || !bcrypt.compareSync(password, row.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (row.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended' });
    }

    if (row.companyId && row.company?.status === 'suspended') {
      return res.status(403).json({
        error: 'This organisation has been suspended. Contact platform support.'
      });
    }

    res.json({ token: signToken(row), user: await toAppUser(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, loadUser, async (req, res, next) => {
  try {
    let subscription = null;
    if (req.user.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId }
      });
      if (company) subscription = cachedCompanySubscription(company);
    }

    const supervised =
      req.user.role === 'team_lead'
        ? await loadSupervisedAdrs(req.user.id)
        : null;

    res.json({
      user: {
        ...serializeAppUser(
          {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            company: { name: req.user.company },
            scope: req.user.scope,
            zone: req.user.zone
          },
          supervised
        )
      },
      subscription
    });
  } catch (err) {
    next(err);
  }
});

router.get('/demo-users', async (_req, res, next) => {
  try {
  const order = [
    'system_owner',
    'platform_staff',
    'manager',
    'internal',
    'team_lead',
    'adr',
    'agent',
    'teller'
  ];
    const users = await prisma.user.findMany({
      where: { role: { in: order } },
      include: { company: true }
    });

    const seen = new Set();
    const unique = users
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
      .filter((u) => {
        if (seen.has(u.role)) return false;
        seen.add(u.role);
        return true;
      });

    res.json(
      unique.map((u) => ({
        email: u.email,
        role: u.role,
        name: u.name,
        company: u.company?.name || 'ANMS Platform'
      }))
    );
  } catch (err) {
    next(err);
  }
});

export default router;
