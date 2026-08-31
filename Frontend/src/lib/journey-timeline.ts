import type { OfficerJourney } from './api';

export type JourneyTimelineStop = {
  id: string;
  kind: 'duty_start' | 'duty_end' | 'visit' | 'route_start' | 'route_end';
  at: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  visitId?: number;
  visitOrder?: number;
};

function parseAt(iso: string) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function nearestPathPoint(
  path: OfficerJourney['path'],
  targetIso: string,
  prefer: 'before' | 'after' | 'closest' = 'closest'
) {
  if (!path.length) return null;
  const target = parseAt(targetIso);
  if (!target) return path[0];

  let best = path[0];
  let bestDiff = Math.abs(parseAt(best.captured_at) - target);

  for (const p of path) {
    const ts = parseAt(p.captured_at);
    const diff = Math.abs(ts - target);
    if (prefer === 'before' && ts > target) continue;
    if (prefer === 'after' && ts < target) continue;
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

function visitTimestamp(journey: OfficerJourney, time: string) {
  const fromPath = journey.path.find(
    (p) => p.source === 'visit_checkin' && p.captured_at.includes(`T${time}`)
  );
  if (fromPath) return fromPath.captured_at;
  return `${journey.date}T${time}:00`;
}

export function buildJourneyTimeline(journey: OfficerJourney): JourneyTimelineStop[] {
  const stops: JourneyTimelineStop[] = [];
  const path = journey.path;

  for (const session of journey.sessions) {
    const startPt = nearestPathPoint(path, session.started_at, 'after') ?? path[0];
    if (startPt) {
      stops.push({
        id: `duty-start-${session.id}`,
        kind: 'duty_start',
        at: session.started_at,
        lat: startPt.lat,
        lng: startPt.lng,
        title: 'Duty started',
        subtitle: 'Officer began field tracking'
      });
    }
    if (session.ended_at) {
      const endPt =
        nearestPathPoint(path, session.ended_at, 'before') ?? path[path.length - 1];
      if (endPt) {
        stops.push({
          id: `duty-end-${session.id}`,
          kind: 'duty_end',
          at: session.ended_at,
          lat: endPt.lat,
          lng: endPt.lng,
          title: 'Duty ended',
          subtitle: 'Field tracking stopped'
        });
      }
    }
  }

  const visits = [...journey.visits]
    .filter((v) => v.check_in_lat != null && v.check_in_lng != null)
    .sort((a, b) => a.time.localeCompare(b.time));

  visits.forEach((v, index) => {
    stops.push({
      id: `visit-${v.id}`,
      kind: 'visit',
      at: visitTimestamp(journey, v.time),
      lat: v.check_in_lat!,
      lng: v.check_in_lng!,
      title: v.agent_name,
      subtitle: `${v.time} · ${v.type}`,
      visitId: v.id,
      visitOrder: index + 1
    });
  });

  if (!stops.length && path.length) {
    stops.push({
      id: 'route-start',
      kind: 'route_start',
      at: path[0].captured_at,
      lat: path[0].lat,
      lng: path[0].lng,
      title: 'Journey start',
      subtitle: 'First GPS point'
    });
    if (path.length > 1) {
      const last = path[path.length - 1];
      stops.push({
        id: 'route-end',
        kind: 'route_end',
        at: last.captured_at,
        lat: last.lat,
        lng: last.lng,
        title: 'Latest position',
        subtitle: 'Last GPS point'
      });
    }
  }

  return stops.sort((a, b) => parseAt(a.at) - parseAt(b.at));
}

/** Path points captured at or before the timeline stop time. */
export function pathUpToTime(
  path: OfficerJourney['path'],
  atIso: string
): OfficerJourney['path'] {
  const cutoff = parseAt(atIso);
  if (!cutoff) return path;
  return path.filter((p) => parseAt(p.captured_at) <= cutoff);
}

export function stopKindLabel(kind: JourneyTimelineStop['kind']) {
  switch (kind) {
    case 'duty_start':
      return 'Start duty';
    case 'duty_end':
      return 'End duty';
    case 'visit':
      return 'Visit';
    case 'route_start':
      return 'Start';
    case 'route_end':
      return 'End';
    default:
      return 'Stop';
  }
}
