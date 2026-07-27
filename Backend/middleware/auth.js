import jwt from 'jsonwebtoken';
import { assertUserMayAccess } from '../lib/subscription-lifecycle.js';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : 'field-pro-dev-secret');

if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, companyId: user.companyId ?? user.company_id },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/** Invited users must set a password before using the rest of the API. */
export function requireActiveAccount(req, res, next) {
  if (req.user?.status === 'invited') {
    return res.status(403).json({
      error: 'Set a new password before continuing',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }
  next();
}

/**
 * Enforce subscription lock / grace.
 * Locked companies: only managers may call billing/payment endpoints.
 */
export function requireSubscriptionAccess(req, res, next) {
  try {
    const company = req.user?.companyRecord;
    if (!company) return next();

    const result = assertUserMayAccess(req.user, company, req.path);
    if (result.ok) {
      req.subscriptionAccess = result.access;
      return next();
    }
    return res.status(403).json({
      error: result.error,
      code: result.code
    });
  } catch (err) {
    next(err);
  }
}
