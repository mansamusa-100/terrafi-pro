import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import {
  getActiveSession,
  startJourneySession,
  endJourneySession,
  recordPings
} from '../lib/journey-tracking.js';

const router = Router();

router.get('/session', requireRoles('adr'), async (req, res, next) => {
  try {
    const session = await getActiveSession(req.user.id);
    res.json({
      active: !!session,
      session: session
        ? {
            id: session.id,
            started_at: session.startedAt.toISOString(),
            device_id: session.deviceId
          }
        : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/session/start', requireRoles('adr'), async (req, res, next) => {
  try {
    const { lat, lng, accuracy, device_id } = req.body;
    const result = await startJourneySession(req.user, {
      lat,
      lng,
      accuracy,
      deviceId: device_id
    });
    res.status(result.resumed ? 200 : 201).json({
      resumed: result.resumed,
      session: {
        id: result.session.id,
        started_at: result.session.startedAt.toISOString(),
        device_id: result.session.deviceId
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/session/end', requireRoles('adr'), async (req, res, next) => {
  try {
    const { lat, lng, accuracy, device_id } = req.body;
    const session = await endJourneySession(req.user, {
      lat,
      lng,
      accuracy,
      deviceId: device_id
    });
    if (!session) {
      return res.status(404).json({ error: 'No active duty session' });
    }
    res.json({
      session: {
        id: session.id,
        started_at: session.startedAt.toISOString(),
        ended_at: session.endedAt?.toISOString() || null
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/pings', requireRoles('adr'), async (req, res, next) => {
  try {
    const { session_id, pings, device_id } = req.body;
    const result = await recordPings(req.user, {
      sessionId: session_id,
      pings,
      deviceId: device_id
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
