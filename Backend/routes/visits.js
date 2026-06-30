import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { companyFilter, todayISO, isAgentAssignedToUser } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { verifyGpsCheckIn } from '../lib/geo.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    const visitDate =
      req.query.date === 'today' || !req.query.date
        ? todayISO()
        : String(req.query.date);

    const where = { visitDate };
    if (companyId) where.companyId = companyId;
    if (req.user.role === 'adr') where.officer = req.user.name;

    const visits = await prisma.visit.findMany({
      where,
      orderBy: { time: 'asc' }
    });

    res.json(
      visits.map((v) => ({
        id: v.id,
        agent_id: v.agentId,
        agent: v.agentName,
        officer: v.officer,
        status: v.status,
        time: v.time,
        type: v.type,
        zone: v.zone,
        visit_date: v.visitDate,
        efloat: v.efloat,
        cash: v.cash,
        notes: v.notes,
        compliance_passed: v.compliancePassed,
        compliance_total: v.complianceTotal,
        gps_verified: v.gpsVerified,
        distance_meters: v.distanceMeters
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRoles('manager', 'adr'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 'co-aps';
    const {
      agentId,
      type,
      efloat,
      cash,
      notes,
      compliancePassed,
      complianceTotal,
      checkInLat,
      checkInLng
    } = req.body;

    if (!agentId || !type) {
      return res.status(400).json({ error: 'Agent and visit type are required' });
    }
    if (checkInLat == null || checkInLng == null) {
      return res
        .status(400)
        .json({ error: 'GPS check-in coordinates are required' });
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!isAgentAssignedToUser(agent, req.user)) {
      return res.status(403).json({ error: 'Agent is not assigned to you' });
    }

    const gps = verifyGpsCheckIn(agent.lat, agent.lng, checkInLat, checkInLng);
    if (!gps.verified) {
      return res.status(400).json({
        error: `GPS check-in failed — you are ${gps.distanceMeters}m from the agent (max 250m)`
      });
    }

    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const visitDate = todayISO();
    const officer = req.user.role === 'adr' ? req.user.name : agent.officer;

    const newEfloat = efloat ?? agent.efloat;
    const newCash = cash ?? agent.cash;
    const total = newEfloat + newCash;
    let status = agent.status;
    if (total < 3000) status = 'critical';
    else if (total < 10000) status = 'low_float';
    else if (agent.status !== 'suspended') status = 'active';

    const visit = await prisma.$transaction(async (tx) => {
      const created = await tx.visit.create({
        data: {
          companyId,
          agentId,
          agentName: agent.name,
          officer,
          status: 'done',
          time,
          type,
          zone: agent.zone,
          visitDate,
          efloat: newEfloat,
          cash: newCash,
          notes: notes || null,
          compliancePassed: compliancePassed ?? 0,
          complianceTotal: complianceTotal ?? 5,
          checkInLat,
          checkInLng,
          gpsVerified: true,
          distanceMeters: gps.distanceMeters
        }
      });

      await tx.agent.update({
        where: { id: agentId },
        data: {
          efloat: newEfloat,
          cash: newCash,
          status,
          visits: { increment: 1 },
          lastVisit: 'Today'
        }
      });

      await tx.officer.updateMany({
        where: { name: officer, companyId },
        data: { visits: { increment: 1 } }
      });

      return created;
    });

    res.status(201).json({
      id: visit.id,
      agent: visit.agentName,
      officer: visit.officer,
      status: visit.status,
      time: visit.time,
      type: visit.type,
      zone: visit.zone,
      gps_verified: visit.gpsVerified,
      distance_meters: visit.distanceMeters
    });
  } catch (err) {
    next(err);
  }
});

export default router;
