import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  companyFilter,
  todayISO,
  isAgentAssignedToUser,
  resolveOfficerAssignment
} from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { verifyGpsCheckIn } from '../lib/geo.js';
import { notifyVisitLogged, notifyVisitScheduled } from '../lib/notifications.js';
import { syncFloatAlertsForAgent } from '../lib/float-alerts.js';
import { buildVisitSummary, markOverdueVisits } from '../lib/visit-utils.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

const VISIT_TYPES = [
  'Float check',
  'Branding audit',
  'KYC renewal',
  'Equipment check',
  'Issue follow-up'
];

router.get('/summary', async (req, res, next) => {
  try {
    const summary = await buildVisitSummary(req.user);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    const visitDate =
      req.query.date === 'today' || !req.query.date
        ? todayISO()
        : String(req.query.date);

    if (companyId) {
      await markOverdueVisits(
        companyId,
        req.user.role === 'adr' ? req.user.name : null
      );
    }

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

router.post('/schedule', requireRoles('manager', 'adr'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 'co-aps';
    const { agentId, type, visitDate, time, notes, officer_id } = req.body;

    if (!agentId || !type) {
      return res.status(400).json({ error: 'Agent and visit type are required' });
    }
    if (!VISIT_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid visit type' });
    }

    const date = visitDate || todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid visit date' });
    }
    if (date < todayISO()) {
      return res.status(400).json({ error: 'Cannot schedule visits in the past' });
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.companyId !== companyId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (!isAgentAssignedToUser(agent, req.user)) {
      return res.status(403).json({ error: 'Agent is not assigned to you' });
    }

    const existingPending = await prisma.visit.findFirst({
      where: {
        companyId,
        agentId,
        visitDate: date,
        status: 'pending'
      }
    });
    if (existingPending) {
      return res.status(409).json({
        error: 'This agent already has a pending visit scheduled for that date'
      });
    }

    let officer;
    if (req.user.role === 'adr') {
      officer = { officerId: req.user.id, officer: req.user.name };
    } else {
      officer = await resolveOfficerAssignment(companyId, {
        officerId: officer_id,
        officerName: agent.officer,
        fallback: { officerId: agent.officerId, officer: agent.officer }
      });
      if (!officer) {
        return res.status(400).json({ error: 'Invalid ADR assignment' });
      }
    }

    const visitTime = time?.trim() || '09:00';

    const visit = await prisma.visit.create({
      data: {
        companyId,
        agentId,
        agentName: agent.name,
        officer: officer.officer,
        status: 'pending',
        time: visitTime,
        type,
        zone: agent.zone,
        visitDate: date,
        notes: notes?.trim() || null
      }
    });

    await notifyVisitScheduled(visit, agent, req.user);

    await logAudit({
      scope: 'company',
      companyId,
      actor: req.user,
      action: 'visit.scheduled',
      entityType: 'visit',
      entityId: String(visit.id),
      details: {
        agentName: agent.name,
        visitDate: date,
        type,
        officer: officer.officer
      }
    });

    res.status(201).json({
      id: visit.id,
      agent: visit.agentName,
      agent_id: visit.agentId,
      officer: visit.officer,
      status: visit.status,
      time: visit.time,
      type: visit.type,
      zone: visit.zone,
      visit_date: visit.visitDate,
      notes: visit.notes
    });
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
    let agentStatus = agent.status;
    if (total < 3000) agentStatus = 'critical';
    else if (total < 10000) agentStatus = 'low_float';
    else if (agent.status !== 'suspended') agentStatus = 'active';

    const pending = await prisma.visit.findFirst({
      where: {
        companyId,
        agentId,
        visitDate,
        status: 'pending'
      }
    });

    const visit = await prisma.$transaction(async (tx) => {
      let record;
      const visitData = {
        status: 'done',
        time,
        type,
        efloat: newEfloat,
        cash: newCash,
        notes: notes || null,
        compliancePassed: compliancePassed ?? 0,
        complianceTotal: complianceTotal ?? 5,
        checkInLat,
        checkInLng,
        gpsVerified: true,
        distanceMeters: gps.distanceMeters
      };

      if (pending) {
        record = await tx.visit.update({
          where: { id: pending.id },
          data: visitData
        });
      } else {
        record = await tx.visit.create({
          data: {
            companyId,
            agentId,
            agentName: agent.name,
            officer,
            zone: agent.zone,
            visitDate,
            ...visitData
          }
        });
      }

      await tx.agent.update({
        where: { id: agentId },
        data: {
          efloat: newEfloat,
          cash: newCash,
          status: agentStatus,
          visits: { increment: 1 },
          lastVisit: 'Today'
        }
      });

      await tx.officer.updateMany({
        where: { name: officer, companyId },
        data: { visits: { increment: 1 } }
      });

      return record;
    });

    await syncFloatAlertsForAgent(agentId);
    await notifyVisitLogged(visit, agent, req.user);

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

router.patch('/:id', requireRoles('manager', 'adr'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 'co-aps';
    const visit = await prisma.visit.findFirst({
      where: { id: Number(req.params.id), companyId }
    });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    if (req.user.role === 'adr' && visit.officer !== req.user.name) {
      return res.status(403).json({ error: 'Visit is not assigned to you' });
    }

    const { status, visitDate, time, notes } = req.body;
    const data = {};

    if (status) {
      if (!['pending', 'missed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      if (visit.status === 'done') {
        return res.status(400).json({ error: 'Completed visits cannot be changed' });
      }
      data.status = status;
    }

    if (visitDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
        return res.status(400).json({ error: 'Invalid visit date' });
      }
      if (visitDate < todayISO()) {
        return res.status(400).json({ error: 'Cannot reschedule to a past date' });
      }
      data.visitDate = visitDate;
      if (status === undefined && visit.status === 'missed') {
        data.status = 'pending';
      }
    }

    if (time) data.time = time;
    if (notes !== undefined) data.notes = notes?.trim() || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.visit.update({
      where: { id: visit.id },
      data
    });

    res.json({
      id: updated.id,
      agent: updated.agentName,
      agent_id: updated.agentId,
      officer: updated.officer,
      status: updated.status,
      time: updated.time,
      type: updated.type,
      zone: updated.zone,
      visit_date: updated.visitDate,
      notes: updated.notes
    });
  } catch (err) {
    next(err);
  }
});

export default router;
