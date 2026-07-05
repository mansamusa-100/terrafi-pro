import { prisma } from './prisma.js';
import {
  DEFAULT_BRANDING_TYPES,
  DEFAULT_BUSINESS_TYPES,
  DEFAULT_COMPETITORS,
  getOnboardingConfig,
  parseStringArray
} from './onboarding-config.js';

export const COVERAGE_MODELS = ['Officer-based', 'Zone-based', 'Hybrid'];

export const EDITABLE_FIELDS = new Set([
  'default_float_threshold',
  'visit_frequency_target',
  'alert_notification_delay_minutes',
  'auto_suspend_missed_visits_days',
  'active_zones',
  'sub_territories',
  'coverage_model',
  'business_types',
  'zone_names',
  'competitor_names',
  'branding_types'
]);

const FIELD_TO_COLUMN = {
  default_float_threshold: 'defaultFloatThreshold',
  visit_frequency_target: 'visitFrequencyTarget',
  alert_notification_delay_minutes: 'alertNotificationDelayMinutes',
  auto_suspend_missed_visits_days: 'autoSuspendMissedVisitsDays',
  active_zones: 'activeZones',
  sub_territories: 'subTerritories',
  coverage_model: 'coverageModel',
  business_types: 'businessTypes',
  zone_names: 'zoneNames',
  competitor_names: 'competitorNames',
  branding_types: 'brandingTypes'
};

const ARRAY_DEFAULTS = {
  business_types: DEFAULT_BUSINESS_TYPES,
  zone_names: [],
  competitor_names: DEFAULT_COMPETITORS,
  branding_types: DEFAULT_BRANDING_TYPES
};

export function resolveSettingsCompanyId(user, queryCompanyId) {
  if (user.role === 'system_owner') {
    return queryCompanyId || 'co-aps';
  }
  if (user.role === 'manager') {
    return user.companyId;
  }
  return null;
}

export async function getOrCreateCompanySettings(companyId) {
  let row = await prisma.companySettings.findUnique({ where: { companyId } });
  if (!row) {
    row = await prisma.companySettings.create({
      data: {
        companyId,
        businessTypes: DEFAULT_BUSINESS_TYPES,
        competitorNames: DEFAULT_COMPETITORS,
        brandingTypes: DEFAULT_BRANDING_TYPES
      }
    });
  }
  return row;
}

export async function serializeCompanySettings(row) {
  const onboarding = await getOnboardingConfig(row.companyId);
  return {
    company_id: row.companyId,
    network: {
      default_float_threshold: row.defaultFloatThreshold,
      visit_frequency_target: row.visitFrequencyTarget,
      alert_notification_delay_minutes: row.alertNotificationDelayMinutes,
      auto_suspend_missed_visits_days: row.autoSuspendMissedVisitsDays
    },
    zones: {
      active_zones: row.activeZones,
      sub_territories: row.subTerritories,
      coverage_model: row.coverageModel
    },
    onboarding,
    integration: {
      core_wallet_api: row.coreWalletApiStatus,
      sms_gateway: row.smsGatewayStatus,
      email_notifications: row.emailNotificationsStatus,
      export_format: row.exportFormat
    },
    integration_editable: false,
    updated_at: row.updatedAt.toISOString()
  };
}

function parseIntField(key, value) {
  const num = Number.parseInt(String(value), 10);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid value for ${key}`);
  }
  return num;
}

export function buildSettingsUpdate(body) {
  const data = {};
  for (const [apiKey, column] of Object.entries(FIELD_TO_COLUMN)) {
    if (body[apiKey] === undefined) continue;
    if (!EDITABLE_FIELDS.has(apiKey)) {
      throw new Error(`Field ${apiKey} is not editable`);
    }
    if (apiKey === 'coverage_model') {
      const value = String(body[apiKey]).trim();
      if (!COVERAGE_MODELS.includes(value)) {
        throw new Error('Invalid coverage model');
      }
      data[column] = value;
      continue;
    }
    if (ARRAY_DEFAULTS[apiKey] !== undefined) {
      const arr = parseStringArray(body[apiKey], ARRAY_DEFAULTS[apiKey]);
      if (arr.length === 0) {
        throw new Error(`${apiKey} must include at least one item`);
      }
      if (apiKey === 'business_types' && !arr.includes('Others')) {
        arr.push('Others');
      }
      data[column] = arr;
      continue;
    }
    data[column] = parseIntField(apiKey, body[apiKey]);
  }
  if (Object.keys(data).length === 0) {
    throw new Error('No editable fields provided');
  }
  return data;
}
