import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { loadUser } from '../middleware/user.js';

const router = Router();

function toAppUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    company: row.company?.name || 'ANMS Platform',
    scope: row.scope
  };
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

    res.json({ token: signToken(row), user: toAppUser(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, loadUser, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      company: req.user.company,
      scope: req.user.scope
    }
  });
});

router.get('/demo-users', async (_req, res, next) => {
  try {
  const order = [
    'system_owner',
    'platform_staff',
    'manager',
      'internal',
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
