import type { Agent } from './api';
import { distanceMeters, type GeoCoords } from './geolocation';

export function agentDistanceMeters(agent: Agent, userCoords: GeoCoords | null): number | null {
  if (!userCoords || agent.lat == null || agent.lng == null) return null;
  return Math.round(
    distanceMeters(userCoords.lat, userCoords.lng, agent.lat, agent.lng)
  );
}

export function formatDistance(meters: number | null): string {
  if (meters == null) return '';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function compareAgentDistance(
  a: Agent,
  b: Agent,
  userCoords: GeoCoords | null
): number {
  const da = agentDistanceMeters(a, userCoords) ?? Number.POSITIVE_INFINITY;
  const db = agentDistanceMeters(b, userCoords) ?? Number.POSITIVE_INFINITY;
  return da - db;
}
