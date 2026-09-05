export type SubTerritoryMap = Record<string, string[]>;

export function subTerritoriesForZone(
  map: SubTerritoryMap | undefined | null,
  zone: string
): string[] {
  if (!map || !zone) return [];
  return Array.isArray(map[zone]) ? map[zone] : [];
}

export function countSubTerritories(map: SubTerritoryMap | undefined | null): number {
  if (!map) return 0;
  return Object.values(map).reduce(
    (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
    0
  );
}
