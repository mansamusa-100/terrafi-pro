import { prisma } from './prisma.js';

export const COVERAGE_MODELS = ['Officer-based', 'Zone-based', 'Hybrid'];

export const EDITABLE_FIELDS = new Set([
  'default_float_threshold',
  'visit_frequency_target',
  'alert_notification_delay_minutes',
  'auto_suspend_missed_visits_days',
  'active_zones',
  'sub_territories',
  'coverage_model'
]);

const FIELD_TO_COLUMN = {
  default_float_threshold: 'defaultFloatThreshold',
  visit_frequency_target: 'visitFrequencyTarget',
  alert_notification_delay_minutes: 'alertNotificationDelayMinutes',
  auto_suspend_missed_visits_days: 'autoSuspendMissedVisitsDays',
  active_zones: 'activeZones',
  sub_territories: 'subTerritories',
  coverage_model: 'coverageModel'
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
    row = await prisma.companySettings.create({ data: { companyId } });
  }
  return row;
}

export function serializeCompanySettings(row) {
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
    data[column] = parseIntField(apiKey, body[apiKey]);
  }
  if (Object.keys(data).length === 0) {
    throw new Error('No editable fields provided');
  }
  return data;
}
