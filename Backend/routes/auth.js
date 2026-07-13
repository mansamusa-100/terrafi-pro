import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { loadUser, serializeAppUser } from '../middleware/user.js';
import { loadSupervisedAdrs } from '../lib/team-lead.js';
import { cachedCompanySubscription } from '../lib/company-billing.js';
import { logAudit } from '../lib/audit.js';
import {
  findUsersByEmail,
  loginEligibilityError,
  serializeWorkspace,
  usersMatchingPassword
} from '../lib/user-email.js';

const router = Router();

async function toAppUser(row) {
  const supervised =
    row.role === 'team_lead' ? await loadSupervisedAdrs(row.id) : null;
  return serializeAppUser(row, supervised);
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, userId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const candidates = await findUsersByEmail(email);
    const matched = usersMatchingPassword(candidates, password);

    if (matched.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let row = matched[0];
    if (userId) {
      row = matched.find((u) => u.id === userId);
      if (!row) {
        return res.status(401).json({ error: 'Invalid workspace selection' });
      }
    } else if (matched.length > 1) {
      const eligible = matched.filter((u) => !loginEligibilityError(u));
      if (eligible.length === 0) {
        return res.status(403).json({ error: loginEligibilityError(matched[0]) });
      }
      if (eligible.length > 1) {
        return res.json({
          requiresWorkspaceSelection: true,
          workspaces: eligible.map(serializeWorkspace)
        });
      }
      row = eligible[0];
    }

    const blocked = loginEligibilityError(row);
    if (blocked) {
      return res.status(403).json({ error: blocked });
    }

    res.json({ token: signToken(row), user: await toAppUser(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, loadUser, async (req, res, next) => {
  try {
    const row = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { company: true }
    });
    if (!row) {
      return res.status(401).json({ error: 'User not found' });
    }

    let subscription = null;
    if (row.companyId && row.company) {
      subscription = cachedCompanySubscription(row.company);
    }

    res.json({
      user: await toAppUser(row),
      subscription
    });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authMiddleware, loadUser, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters'
      });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: 'Choose a password different from your temporary one'
      });
    }

    const row = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { company: true }
    });
    if (!row) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (row.status !== 'invited') {
      return res.status(400).json({
        error: 'Password has already been set for this account'
      });
    }
    if (!bcrypt.compareSync(currentPassword, row.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const updated = await prisma.user.update({
      where: { id: row.id },
      data: {
        passwordHash: bcrypt.hashSync(newPassword, 10),
        status: 'active'
      },
      include: { company: true }
    });

    await logAudit({
      scope: updated.companyId ? 'company' : 'platform',
      companyId: updated.companyId,
      actor: updated,
      action: 'auth.password_set',
      entityType: 'user',
      entityId: updated.id,
      details: { email: updated.email }
    });

    res.json({ user: await toAppUser(updated) });
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
        company: u.company?.name || 'Terrafi Pro Platform'
      }))
    );
  } catch (err) {
    next(err);
  }
});

export default router;
