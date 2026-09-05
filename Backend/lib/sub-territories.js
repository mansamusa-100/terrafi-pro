export function parseSubTerritoryMap(value) {
  let raw = value;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new Error('Invalid sub_territory_map JSON');
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const map = {};
  for (const [zone, names] of Object.entries(raw)) {
    const z = String(zone).trim();
    if (!z) continue;
    const list = Array.isArray(names)
      ? names.map((v) => String(v).trim()).filter(Boolean)
      : typeof names === 'string'
        ? names
            .split(/[\n,]/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    if (list.length) map[z] = [...new Set(list)];
  }
  return map;
}

export function countSubTerritories(map) {
  return Object.values(map || {}).reduce(
    (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
    0
  );
}

export function subTerritoriesForZone(map, zone) {
  if (!zone || !map) return [];
  return Array.isArray(map[zone]) ? map[zone] : [];
}

export function resolveAgentSubTerritory(map, zone, raw) {
  const options = subTerritoriesForZone(map, zone);
  const value = raw == null ? '' : String(raw).trim();
  if (options.length === 0) {
    return { value: value || null };
  }
  if (!value) {
    return { error: 'Sub-territory is required for this region' };
  }
  if (!options.includes(value)) {
    return { error: `Sub-territory must be one of: ${options.join(', ')}` };
  }
  return { value };
}
