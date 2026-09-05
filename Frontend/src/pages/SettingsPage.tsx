import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, api, CompanySettings, OnboardingConfig, type VisitTargetClasses } from '../lib/api';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { cn } from '../lib/utils';
import { BillingCard } from '../components/BillingCard';
import { BrandMark } from '../components/BrandMark';
import { countSubTerritories } from '../lib/sub-territories';

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

const INTEGRATION_FIELDS: {
  label: string;
  key: keyof CompanySettings['integration'];
  viewPage?: string;
}[] = [
  { label: 'Core wallet API', key: 'core_wallet_api', viewPage: 'partner-integration' },
  { label: 'SMS gateway', key: 'sms_gateway' },
  { label: 'Email notifications', key: 'email_notifications' },
  { label: 'Export format', key: 'export_format' }
];

function displayValue(field: FieldConfig, settings: CompanySettings) {
  const raw = field.getValue(settings);
  const formatted = field.format(raw);
  return field.suffix ? `${formatted} ${field.suffix}` : formatted;
}

type ListKey = 'business_types' | 'zone_names' | 'competitor_names' | 'branding_types';

const ONBOARDING_LISTS: {
  key: ListKey;
  apiKey: 'business_types' | 'zone_names' | 'competitor_names' | 'branding_types';
  label: string;
  hint: string;
}[] = [
  {
    key: 'business_types',
    apiKey: 'business_types',
    label: 'Business types',
    hint: 'One per line. "Others" is always kept for custom entries.'
  },
  {
    key: 'zone_names',
    apiKey: 'zone_names',
    label: 'Zone names',
    hint: 'One per line. Used as regions in onboarding and reports.'
  },
  {
    key: 'competitor_names',
    apiKey: 'competitor_names',
    label: 'Competitor names',
    hint: 'One per line. Shown when logging competitors at a location.'
  },
  {
    key: 'branding_types',
    apiKey: 'branding_types',
    label: 'Branding types',
    hint: 'One per line. e.g. Poster, Sticker, Banner.'
  }
];

function OnboardingListsSection({
  onboarding,
  onSaved
}: {
  onboarding: OnboardingConfig;
  onSaved: (onboarding: OnboardingConfig) => void;
}) {
  const [editingKey, setEditingKey] = useState<ListKey | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (key: ListKey) => {
    setEditingKey(key);
    setDraft(onboarding[key].join('\n'));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft('');
  };

  const saveList = async (apiKey: (typeof ONBOARDING_LISTS)[number]['apiKey']) => {
    setSaving(true);
    try {
      const updated = await api.settings.update({ [apiKey]: draft });
      onSaved(updated.onboarding);
      setEditingKey(null);
      setDraft('');
      toast.success('Onboarding list saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">
        Agent onboarding lists
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Configure dropdowns and checklists used when registering new agents.
      </p>
      {ONBOARDING_LISTS.map(({ key, apiKey, label, hint }) => {
        const isEditing = editingKey === key;
        return (
          <div
            key={key}
            className="py-4 border-b border-slate-100 last:border-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900">{label}</div>
                <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
                {isEditing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={5}
                    className="mt-3 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono resize-y"
                  />
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {onboarding[key].map((item) => (
                      <span
                        key={item}
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => saveList(apiKey)}
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
                  <button
                    type="button"
                    onClick={() => startEdit(key)}
                    className="text-xs text-apsBlue bg-apsBlueLt hover:bg-apsBlue/20 px-3 py-1 rounded-md font-medium transition-colors">
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubTerritoriesByZoneSection({
  zoneNames,
  map,
  onSaved
}: {
  zoneNames: string[];
  map: Record<string, string[]>;
  onSaved: (onboarding: OnboardingConfig, subCount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const zoneKeys = useMemo(() => {
    const extra = Object.keys(map).filter((z) => !zoneNames.includes(z));
    return [...zoneNames, ...extra];
  }, [zoneNames, map]);

  const startEdit = () => {
    const next: Record<string, string> = {};
    for (const zone of zoneKeys) {
      next[zone] = (map[zone] || []).join('\n');
    }
    setDraft(next);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const nextMap: Record<string, string[]> = {};
      for (const [zone, text] of Object.entries(draft)) {
        const names = text
          .split(/[\n,]/)
          .map((v) => v.trim())
          .filter(Boolean);
        if (names.length) nextMap[zone] = [...new Set(names)];
      }
      const updated = await api.settings.update({ sub_territory_map: nextMap });
      onSaved(updated.onboarding, updated.zones.sub_territories);
      setEditing(false);
      toast.success('Sub-territories saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const total = countSubTerritories(map);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Sub-territories by region
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Nested under each region. Shown as “Sub Region” on the Agent report
            and required at onboarding when a region has names configured.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {total} sub-territor{total === 1 ? 'y' : 'ies'} across {zoneKeys.length} region
            {zoneKeys.length === 1 ? '' : 's'}
          </p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="text-xs text-white bg-apsBlue hover:bg-apsBlue/90 px-3 py-1 rounded-md font-medium disabled:opacity-50">
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="text-xs text-slate-600 hover:bg-slate-100 px-3 py-1 rounded-md font-medium">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs text-apsBlue bg-apsBlueLt hover:bg-apsBlue/20 px-3 py-1 rounded-md font-medium transition-colors shrink-0">
            Edit
          </button>
        )}
      </div>

      {zoneKeys.length === 0 ? (
        <p className="text-xs text-slate-500">
          Add zone names above first, then nest sub-territories under each region.
        </p>
      ) : (
        <div className="space-y-3">
          {zoneKeys.map((zone) => {
            const names = editing
              ? (draft[zone] || '')
                  .split(/[\n,]/)
                  .map((v) => v.trim())
                  .filter(Boolean)
              : map[zone] || [];
            return (
              <div
                key={zone}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="text-sm font-medium text-slate-900">{zone}</div>
                {editing ? (
                  <textarea
                    value={draft[zone] || ''}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [zone]: e.target.value }))
                    }
                    rows={3}
                    placeholder="One sub-territory per line"
                    className="mt-2 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono resize-y bg-white"
                  />
                ) : names.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {names.map((item) => (
                      <span
                        key={item}
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    No sub-territories for this region
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VisitTargetClassesSection({
  thresholds,
  onSaved
}: {
  thresholds: VisitTargetClasses;
  onSaved: (next: VisitTargetClasses) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thresholds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(thresholds);
  }, [thresholds, editing]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.settings.update({ visit_target_classes: draft });
      onSaved(updated.network.visit_target_classes);
      setEditing(false);
      toast.success('Visit target classes saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof VisitTargetClasses; label: string; hint: string }[] = [
    {
      key: 'exceeded_min',
      label: 'Exceeded (min %)',
      hint: 'Visit rate at or above this → Exceeded'
    },
    {
      key: 'met_min',
      label: 'Met (min %)',
      hint: 'At or above → Met (below Exceeded threshold)'
    },
    {
      key: 'below_min',
      label: 'Below (min %)',
      hint: 'At or above → Below; under this → Critical'
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">Visit target classes</h3>
      <p className="text-xs text-slate-500 mb-4">
        Thresholds for officer visit achievement in Performance → Officer report.
        Critical is anything below the Below minimum.
      </p>
      <div className="space-y-3">
        {fields.map(({ key, label, hint }) => (
          <div
            key={key}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
            <div>
              <div className="text-sm text-slate-900">{label}</div>
              <div className="text-[11px] text-slate-500">{hint}</div>
            </div>
            {editing ? (
              <input
                type="number"
                min={0}
                max={200}
                value={draft[key]}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [key]: Number.parseInt(e.target.value, 10) || 0 }))
                }
                className="text-sm border border-slate-200 rounded-md px-2.5 py-1.5 w-24"
              />
            ) : (
              <span className="text-sm font-medium text-slate-500">{thresholds[key]}%</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        {editing ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="text-xs text-white bg-apsBlue hover:bg-apsBlue/90 px-3 py-1 rounded-md font-medium disabled:opacity-50">
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setDraft(thresholds);
              }}
              className="text-xs text-slate-600 hover:bg-slate-100 px-3 py-1 rounded-md font-medium">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-apsBlue bg-apsBlueLt hover:bg-apsBlue/20 px-3 py-1 rounded-md font-medium transition-colors">
            Edit thresholds
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage({ setPage }: { setPage: (page: string) => void }) {
  const { user, refreshProfile } = useAuth();
  const canEdit = user ? can(user, 'configure') : false;
  const canBilling = user ? can(user, 'manageBilling') : false;
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

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

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const result = await api.settings.uploadLogo(file);
      await refreshProfile();
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              branding: {
                company_name: result.company_name,
                logo_url: result.logo_url
              }
            }
          : prev
      );
      toast.success('Company logo updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    setLogoUploading(true);
    try {
      await api.settings.deleteLogo();
      await refreshProfile();
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              branding: { ...prev.branding, logo_url: null }
            }
          : prev
      );
      toast.success('Company logo removed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Remove failed');
    } finally {
      setLogoUploading(false);
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

      {canEdit && settings.branding && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Company branding
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Shown in the sidebar for everyone in your organisation. Your company
            name comes from registration; upload a logo to personalise it.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <BrandMark
              branding={{
                title: settings.branding.company_name,
                subtitle: 'Agent Network',
                logo_url: settings.branding.logo_url
              }}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                {settings.branding.company_name}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Agent Network</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-apsBlue text-white text-xs font-medium cursor-pointer hover:bg-apsBlueMid disabled:opacity-60">
                <Upload className="w-3.5 h-3.5" />
                {logoUploading ? 'Uploading…' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  aria-label="Upload company logo"
                  disabled={logoUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {settings.branding.logo_url && (
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={handleLogoRemove}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            PNG, JPG or WebP · max 2 MB · square images work best
          </p>
        </div>
      )}

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

      {canEdit && settings.network?.visit_target_classes && (
        <VisitTargetClassesSection
          thresholds={settings.network.visit_target_classes}
          onSaved={(visit_target_classes) =>
            setSettings((prev) =>
              prev
                ? {
                    ...prev,
                    network: { ...prev.network, visit_target_classes }
                  }
                : prev
            )
          }
        />
      )}

      {canEdit && settings.onboarding && (
        <>
          <OnboardingListsSection
            onboarding={settings.onboarding}
            onSaved={(onboarding) =>
              setSettings((prev) => (prev ? { ...prev, onboarding } : prev))
            }
          />
          <SubTerritoriesByZoneSection
            zoneNames={settings.onboarding.zone_names || []}
            map={settings.onboarding.sub_territories_by_zone || {}}
            onSaved={(onboarding, subCount) =>
              setSettings((prev) =>
                prev
                  ? {
                      ...prev,
                      onboarding,
                      zones: { ...prev.zones, sub_territories: subCount }
                    }
                  : prev
              )
            }
          />
        </>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Integration</h3>
        </div>
        {INTEGRATION_FIELDS.map(({ label, key, viewPage }) => (
          <div
            key={key}
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 py-3 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-900">{label}</span>
            <div className="flex items-center gap-3 sm:justify-end">
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
              {canEdit && viewPage && (
                <button
                  type="button"
                  onClick={() => setPage(viewPage)}
                  className="text-xs text-apsBlue bg-apsBlueLt hover:bg-apsBlue/20 px-3 py-1 rounded-md font-medium transition-colors">
                  View
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
