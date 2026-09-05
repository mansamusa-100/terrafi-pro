import { prisma } from './prisma.js';
import { getOrCreateCompanySettings } from './company-settings.js';
import { parseSubTerritoryMap } from './sub-territories.js';

export const DEFAULT_BUSINESS_TYPES = [
  'Retail shop',
  'Pharmacy',
  'Mobile kiosk',
  'Supermarket',
  'Standalone agent booth',
  'Others'
];

export const DEFAULT_BRANDING_TYPES = [
  'Poster',
  'Sticker',
  'Banner',
  'Signboard',
  'Window decal',
  'Branding board'
];

export const DEFAULT_COMPETITORS = [
  'Orange Money',
  'QMoney',
  'Wave',
  'Africell Money'
];

export function parseStringArray(value, fallback) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [...fallback];
}

export async function getOnboardingConfig(companyId) {
  const settings = await getOrCreateCompanySettings(companyId);

  let zoneNames = parseStringArray(settings.zoneNames, []);
  if (zoneNames.length === 0) {
    const zones = await prisma.zone.findMany({ orderBy: { name: 'asc' } });
    zoneNames = zones.map((z) => z.name);
  }

  return {
    business_types: parseStringArray(
      settings.businessTypes,
      DEFAULT_BUSINESS_TYPES
    ),
    zone_names: zoneNames,
    competitor_names: parseStringArray(
      settings.competitorNames,
      DEFAULT_COMPETITORS
    ),
    branding_types: parseStringArray(
      settings.brandingTypes,
      DEFAULT_BRANDING_TYPES
    ),
    sub_territories_by_zone: parseSubTerritoryMap(settings.subTerritoryMap)
  };
}
