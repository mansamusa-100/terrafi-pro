import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, api, CompanySettings } from '../lib/api';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { cn } from '../lib/utils';
import { BillingCard } from '../components/BillingCard';

type FieldConfig = {
  id: keyof CompanySettingsPatchKeys;
  label: string;
  inputType: 'number' | 'select';
  options?: string[];
  suffix?: string;
  format: (value: number | string) => string;
  getValue: (settings: CompanySettings) => number | string;
};

type CompanySettingsPatchKeys = {
  default_float_threshold: number;
  visit_frequency_target: number;
  alert_notification_delay_minutes: number;
  auto_suspend_missed_visits_days: number;
  active_zones: number;
  sub_territories: number;
  coverage_model: string;
};

const COVERAGE_OPTIONS = ['Officer-based', 'Zone-based', 'Hybrid'];

const EDITABLE_SECTIONS: { title: string; fields: FieldConfig[] }[] = [
  {
    title: 'Network configuration',
    fields: [
      {
        id: 'default_float_threshold',
        label: 'Default float threshold (D)',
        inputType: 'number',
        format: (v) => Number(v).toLocaleString(),
        getValue: (s) => s.network.default_float_threshold
      },
      {
        id: 'visit_frequency_target',
        label: 'Visit frequency target',
        inputType: 'number',
        suffix: '/month per officer',
        format: (v) => String(v),
        getValue: (s) => s.network.visit_frequency_target
      },
      {
        id: 'alert_notification_delay_minutes',
        label: 'Alert notification delay',
        inputType: 'number',
        suffix: 'minutes',
        format: (v) => String(v),
        getValue: (s) => s.network.alert_notification_delay_minutes
      },
      {
        id: 'auto_suspend_missed_visits_days',
        label: 'Auto-suspend on missed visits',
        inputType: 'number',
        suffix: 'days',
        format: (v) => String(v),
        getValue: (s) => s.network.auto_suspend_missed_visits_days
      }
    ]
  },
  {
    title: 'Zones & territories',
    fields: [
      {
        id: 'active_zones',
        label: 'Active zones',
        inputType: 'number',
        format: (v) => String(v),
        getValue: (s) => s.zones.active_zones
      },
      {
        id: 'sub_territories',
        label: 'Sub-territories',
        inputType: 'number',
        format: (v) => String(v),
        getValue: (s) => s.zones.sub_territories
      },
      {
        id: 'coverage_model',
        label: 'Coverage model',
        inputType: 'select',
        options: COVERAGE_OPTIONS,
        format: (v) => String(v),
        getValue: (s) => s.zones.coverage_model
      }
    ]
  }
];

const INTEGRATION_FIELDS: { label: string; key: keyof CompanySettings['integration'] }[] = [
  { label: 'Core wallet API', key: 'core_wallet_api' },
  { label: 'SMS gateway', key: 'sms_gateway' },
  { label: 'Email notifications', key: 'email_notifications' },
  { label: 'Export format', key: 'export_format' }
];

function displayValue(field: FieldConfig, settings: CompanySettings) {
  const raw = field.getValue(settings);
  const formatted = field.format(raw);
  return field.suffix ? `${formatted} ${field.suffix}` : formatted;
}

export function SettingsPage() {
  const { user } = useAuth();
  const canEdit = user ? can(user.role, 'configure') : false;
  const canBilling = user ? can(user.role, 'manageBilling') : false;
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.settings.get();
      setSettings(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const startEdit = (field: FieldConfig) => {
    if (!settings) return;
    setEditingId(field.id);
    setDraft(String(field.getValue(settings)));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const saveField = async (field: FieldConfig) => {
    if (!settings) return;
    setSaving(true);
    try {
      const body: Record<string, string | number> = {
        [field.id]:
          field.inputType === 'number'
            ? Number.parseInt(draft, 10)
            : draft.trim()
      };
      const updated = await api.settings.update(body);
      setSettings(updated);
      setEditingId(null);
      setDraft('');
      toast.success('Setting saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-pad max-w-4xl flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page-pad max-w-4xl text-sm text-slate-500">
        Settings could not be loaded.
      </div>
    );
  }

  return (
    <div className="page-pad max-w-4xl">
      {canBilling && <BillingCard />}
      {EDITABLE_SECTIONS.map((section) => (
        <div
          key={section.title}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4 last:mb-0">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">{section.title}</h3>
          {section.fields.map((field) => {
            const isEditing = editingId === field.id;
            return (
              <div
                key={field.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-900">{field.label}</span>
                <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                  {isEditing ? (
                    <>
                      {field.inputType === 'select' ? (
                        <select
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white min-w-[10rem]">
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="text-sm border border-slate-200 rounded-md px-2.5 py-1.5 w-28"
                        />
                      )}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveField(field)}
                        className="text-xs text-white bg-apsBlue hover:bg-apsBlue/90 px-3 py-1 rounded-md font-medium disabled:opacity-50">
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={cancelEdit}
                        className="text-xs text-slate-600 hover:bg-slate-100 px-3 py-1 rounded-md font-medium">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-500">
                        {displayValue(field, settings)}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(field)}
                          className="text-xs text-apsBlue bg-apsBlueLt hover:bg-apsBlue/20 px-3 py-1 rounded-md font-medium transition-colors">
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Integration</h3>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded">
            Read-only for now
          </span>
        </div>
        {INTEGRATION_FIELDS.map(({ label, key }) => (
          <div
            key={key}
            className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-900">{label}</span>
            <span
              className={cn(
                'text-sm font-medium',
                settings.integration[key] === 'Connected' ||
                  settings.integration[key] === 'Active'
                  ? 'text-apsGreen'
                  : 'text-slate-500'
              )}>
              {settings.integration[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
