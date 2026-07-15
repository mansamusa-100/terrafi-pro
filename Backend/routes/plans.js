import { Router } from 'express';
import {
  BILLING_INTERVALS,
  GRACE_DAYS,
  RENEWAL_NOTICE_DAYS,
  listPlansPublic
} from '../lib/plans.js';

const router = Router();

/** Public catalogue for landing + registration (no auth). */
router.get('/', (_req, res) => {
  res.json({
    currency: 'GMD',
    currencySymbol: 'D',
    renewalNoticeDays: RENEWAL_NOTICE_DAYS,
    graceDays: GRACE_DAYS,
    intervals: Object.values(BILLING_INTERVALS).map((i) => ({
      id: i.id,
      label: i.label,
      months: i.months,
      description: i.description
    })),
    plans: listPlansPublic(),
    contact: {
      email: process.env.SUPPORT_EMAIL?.trim() || 'support@terrafi.pro',
      phone: process.env.SUPPORT_PHONE?.trim() || null,
      address:
        process.env.SUPPORT_ADDRESS?.trim() || 'Banjul, The Gambia'
    },
    policies: {
      renewalNotice:
        `We notify your network manager ${RENEWAL_NOTICE_DAYS} days before the subscription period ends.`,
      gracePeriod:
        `If payment is not settled by the period end, access continues for ${GRACE_DAYS} days (grace). After grace, only the network manager can sign in — they must pay to restore the team.`
    }
  });
});

export default router;
