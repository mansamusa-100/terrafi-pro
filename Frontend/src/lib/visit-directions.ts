import type { Agent } from './api';

type AgentLocation = Pick<
  Agent,
  'lat' | 'lng' | 'name' | 'outlet_name' | 'town_village' | 'zone'
>;

export function agentVisitLabel(agent: AgentLocation): string {
  const place = agent.outlet_name?.trim() || agent.name.trim();
  const area = agent.town_village?.trim() || agent.zone?.trim();
  return area ? `${place}, ${area}` : place;
}

export function hasNavigableLocation(
  lat: number | null | undefined,
  lng: number | null | undefined
): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return true;
}

/** Google Maps directions URL — opens native maps app on mobile when available. */
export function buildVisitDirectionsUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${lat},${lng}`,
    travelmode: 'driving'
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openVisitDirections(agent: AgentLocation): boolean {
  if (!hasNavigableLocation(agent.lat, agent.lng)) {
    return false;
  }

  const url = buildVisitDirectionsUrl(agent.lat, agent.lng);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}
