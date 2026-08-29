import { prisma } from './prisma.js';
import { companyFilter } from '../middleware/user.js';

const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pathDistanceKm(points) {
  if (points.length < 2) return 0;
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    m += haversineMeters(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }
  return Math.round((m / 1000) * 10) / 10;
}

export async function getActiveSession(userId) {
  return prisma.journeySession.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: 'desc' }
  });
}

export async function startJourneySession(user, { lat, lng, accuracy, deviceId } = {}) {
  const companyId = companyFilter(user);
  if (!companyId) throw new Error('Company context required');

  const existing = await getActiveSession(user.id);
  if (existing) {
    return { session: existing, resumed: true };
  }

  const session = await prisma.journeySession.create({
    data: {
      userId: user.id,
      companyId,
      deviceId: deviceId?.trim() || null
    }
  });

  if (lat != null && lng != null) {
    await recordPings(user, {
      sessionId: session.id,
      pings: [
        {
          lat: Number(lat),
          lng: Number(lng),
          accuracy: accuracy != null ? Number(accuracy) : null,
          captured_at: new Date().toISOString(),
          source: 'foreground'
        }
      ],
      deviceId
    });
  }

  return { session, resumed: false };
}

export async function endJourneySession(user, { lat, lng, accuracy, deviceId } = {}) {
  const session = await getActiveSession(user.id);
  if (!session) {
    return null;
  }

  if (lat != null && lng != null) {
    await recordPings(user, {
      sessionId: session.id,
      pings: [
        {
          lat: Number(lat),
          lng: Number(lng),
          accuracy: accuracy != null ? Number(accuracy) : null,
          captured_at: new Date().toISOString(),
          source: 'foreground'
        }
      ],
      deviceId
    });
  }

  return prisma.journeySession.update({
    where: { id: session.id },
    data: { endedAt: new Date() }
  });
}

export async function recordPings(user, { sessionId, pings, deviceId }) {
  const companyId = companyFilter(user);
  if (!companyId || !Array.isArray(pings) || !pings.length) {
    return { recorded: 0 };
  }

  let activeSessionId = sessionId || null;
  if (!activeSessionId) {
    const active = await getActiveSession(user.id);
    activeSessionId = active?.id || null;
  }

  const rows = pings
    .map((p) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const capturedAt = p.captured_at ? new Date(p.captured_at) : new Date();
      if (Number.isNaN(capturedAt.getTime())) return null;
      return {
        userId: user.id,
        companyId,
        sessionId: activeSessionId,
        lat,
        lng,
        accuracy: p.accuracy != null ? Number(p.accuracy) : null,
        source: p.source || 'foreground',
        visitId: p.visit_id != null ? Number(p.visit_id) : null,
        capturedAt,
        deviceId: deviceId?.trim() || p.device_id?.trim() || null
      };
    })
    .filter(Boolean);

  if (!rows.length) return { recorded: 0 };

  await prisma.locationPing.createMany({ data: rows });
  return { recorded: rows.length };
}

export async function recordVisitCheckInPing(user, visit, lat, lng, deviceId) {
  return recordPings(user, {
    pings: [
      {
        lat,
        lng,
        captured_at: new Date().toISOString(),
        source: 'visit_checkin',
        visit_id: visit.id
      }
    ],
    deviceId
  });
}

function canViewOfficerJourney(viewer, officerUserId) {
  if (viewer.role === 'adr') return viewer.id === officerUserId;
  if (viewer.role === 'team_lead') {
    return (viewer.supervisedAdrIds || []).includes(officerUserId);
  }
  if (['manager', 'internal'].includes(viewer.role)) return true;
  return false;
}

export async function buildOfficerJourney(viewer, { officerId, date }) {
  const companyId = companyFilter(viewer);
  if (!companyId || !officerId || !date) {
    return null;
  }

  if (!canViewOfficerJourney(viewer, officerId)) {
    return null;
  }

  const officer = await prisma.user.findFirst({
    where: { id: officerId, companyId, role: 'adr' }
  });
  if (!officer) return null;

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const [sessions, pings, visits] = await Promise.all([
    prisma.journeySession.findMany({
      where: {
        userId: officerId,
        companyId,
        startedAt: { lte: dayEnd },
        OR: [{ endedAt: null }, { endedAt: { gte: dayStart } }]
      },
      orderBy: { startedAt: 'asc' }
    }),
    prisma.locationPing.findMany({
      where: {
        userId: officerId,
        companyId,
        capturedAt: { gte: dayStart, lte: dayEnd }
      },
      orderBy: { capturedAt: 'asc' }
    }),
    prisma.visit.findMany({
      where: {
        companyId,
        visitDate: date,
        status: 'done',
        OR: [{ officerId }, { officer: officer.name }]
      },
      orderBy: [{ time: 'asc' }, { id: 'asc' }]
    })
  ]);

  const path = pings.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    captured_at: p.capturedAt.toISOString(),
    source: p.source,
    visit_id: p.visitId,
    accuracy: p.accuracy
  }));

  const activeSession = sessions.find((s) => !s.endedAt) || null;

  return {
    officer: {
      id: officer.id,
      name: officer.name,
      zone: officer.zone,
      status: officer.status
    },
    date,
    sessions: sessions.map((s) => ({
      id: s.id,
      started_at: s.startedAt.toISOString(),
      ended_at: s.endedAt?.toISOString() || null,
      active: !s.endedAt
    })),
    active_session: activeSession
      ? {
          id: activeSession.id,
          started_at: activeSession.startedAt.toISOString()
        }
      : null,
    path,
    distance_km: pathDistanceKm(path),
    visits: visits.map((v) => ({
      id: v.id,
      agent_id: v.agentId,
      agent_name: v.agentName,
      time: v.time,
      type: v.type,
      zone: v.zone,
      gps_verified: v.gpsVerified,
      distance_meters: v.distanceMeters,
      check_in_lat: v.checkInLat,
      check_in_lng: v.checkInLng
    }))
  };
}

export { canViewOfficerJourney, pathDistanceKm };
