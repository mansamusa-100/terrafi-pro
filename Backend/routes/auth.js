import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { loadUser, serializeAppUser } from '../middleware/user.js';
import { loadSupervisedAdrs } from '../lib/team-lead.js';
import { cachedCompanySubscription } from '../lib/company-billing.js';
import { applySubscriptionLifecycle } from '../lib/subscription-lifecycle.js';
import { logAudit } from '../lib/audit.js';
import {
  findUsersByEmail,
  loginEligibilityError,
  pickDefaultMembership,
  serializeWorkspace,
  syncPasswordAcrossEmail,
  usersMatchingPassword
} from '../lib/user-email.js';

const router = Router();

async function toAppUser(row) {
  const supervised =
    row.role === 'team_lead' ? await loadSupervisedAdrs(row.id) : null;
  return serializeAppUser(row, supervised);
}

function subscriptionFor(row) {
  if (!row.companyId || !row.company) return null;
  return cachedCompanySubscription(row.company);
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
    } else {
      // One password, multiple memberships — enter a single workspace.
      // Switch between workspaces after sign-in (not on the public login page).
      row = pickDefaultMembership(matched);
      if (!row) {
        return res.status(403).json({ error: loginEligibilityError(matched[0]) });
      }
    }

    const blocked = loginEligibilityError(row);
    if (blocked) {
      return res.status(403).json({ error: blocked });
    }

    // Unify credentials across memberships after a successful login
    // (fixes legacy invites that created separate passwords).
    if (candidates.length > 1) {
      await syncPasswordAcrossEmail(row.email, row.passwordHash);
    }

    res.json({
      token: signToken(row),
      user: await toAppUser(row),
      subscription: subscriptionFor(row)
    });
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
      await applySubscriptionLifecycle(row.companyId, { notify: true }).catch(
        () => null
      );
      const company = await prisma.company.findUnique({
        where: { id: row.companyId }
      });
      subscription = cachedCompanySubscription(company || row.company);
    }

    res.json({
      user: await toAppUser(row),
      subscription
    });
  } catch (err) {
    next(err);
  }
});

/** List every workspace (membership) for the signed-in email. */
router.get('/workspaces', authMiddleware, loadUser, async (req, res, next) => {
  try {
    const members = await findUsersByEmail(req.user.email);
    const workspaces = members
      .filter((u) => !loginEligibilityError(u))
      .map(serializeWorkspace);
    res.json({ workspaces });
  } catch (err) {
    next(err);
  }
});

/** Switch to another membership without re-entering the password. */
router.post('/switch-workspace', authMiddleware, loadUser, async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const members = await findUsersByEmail(req.user.email);
    const target = members.find((u) => u.id === userId);
    if (!target) {
      return res.status(404).json({ error: 'Workspace not found for this account' });
    }

    const blocked = loginEligibilityError(target);
    if (blocked) {
      return res.status(403).json({ error: blocked });
    }

    if (target.status === 'invited') {
      return res.status(403).json({
        error: 'Set your password on this workspace before switching to it'
      });
    }

    res.json({ token: signToken(target), user: await toAppUser(target), subscription: subscriptionFor(target) });
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

    const newHash = bcrypt.hashSync(newPassword, 10);
    await syncPasswordAcrossEmail(row.email, newHash, { activateInvited: true });

    const updated = await prisma.user.findUnique({
      where: { id: row.id },
      include: { company: true }
    });

    await logAudit({
      scope: updated.companyId ? 'company' : 'platform',
      companyId: updated.companyId,
      actor: updated,
      action: 'auth.password_set',
      entityType: 'user',
      entityId: updated.id,
      details: { email: updated.email, syncedMemberships: true }
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
