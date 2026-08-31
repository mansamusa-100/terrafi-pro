import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import {
  api,
  ApiError,
  FloatIntegrationCredentials,
  FloatIntegrationSettings
} from '../lib/api';
import { cn } from '../lib/utils';

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

function CopyField({
  label,
  value,
  mono = true
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className={cn(
            'flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-800',
            mono && 'font-mono text-xs'
          )}
        />
        <button
          type="button"
          onClick={() => copyText(value, label)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
      </div>
    </div>
  );
}

function SecretField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2"
      />
    </div>
  );
}

function CredentialsReveal({
  credentials,
  onDismiss
}: {
  credentials: FloatIntegrationCredentials;
  onDismiss: () => void;
}) {
  const bundle = [
    `Partner org code: (see above)`,
    `API key: ${credentials.api_key}`,
    `HMAC secret: ${credentials.hmac_secret}`,
    `Encryption key: ${credentials.encryption_key}`
  ].join('\n');

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <KeyRound className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">New credentials generated</p>
          <p className="text-xs text-amber-800/90 mt-1">
            Copy these into PrixBI Partner integration now. They are not shown again after you
            leave this page.
          </p>
        </div>
      </div>
      <CopyField label="API key (Bearer)" value={credentials.api_key} />
      <CopyField label="HMAC secret" value={credentials.hmac_secret} />
      <CopyField label="Encryption key (base64)" value={credentials.encryption_key} />
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => copyText(bundle, 'All credentials')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-700 text-white text-xs font-medium hover:bg-amber-800">
          <Copy className="w-3.5 h-3.5" />
          Copy all for PrixBI
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-400/50 text-xs font-medium text-amber-900 hover:bg-amber-100/80">
          <Check className="w-3.5 h-3.5" />
          I&apos;ve saved them
        </button>
      </div>
    </div>
  );
}

export function FloatIntegrationCard() {
  const [data, setData] = useState<FloatIntegrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState<FloatIntegrationCredentials | null>(null);

  const [bireportsOrgId, setBireportsOrgId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [hmacSecret, setHmacSecret] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await api.settings.floatIntegration.get();
      setData(row);
      setBireportsOrgId(row.bireports_organization_id ?? '');
      setEnabled(row.enabled);
      setApiKey('');
      setHmacSecret('');
      setEncryptionKey('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load partner integration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Parameters<typeof api.settings.floatIntegration.update>[0] = {
        bireports_organization_id: bireportsOrgId.trim(),
        enabled
      };

      const hasSecrets = apiKey.trim() || hmacSecret.trim() || encryptionKey.trim();
      if (hasSecrets) {
        if (!apiKey.trim() || !hmacSecret.trim() || !encryptionKey.trim()) {
          toast.error('Provide all three secrets together, or leave them all blank');
          setSaving(false);
          return;
        }
        body.api_key = apiKey.trim();
        body.hmac_secret = hmacSecret.trim();
        body.encryption_key = encryptionKey.trim();
      } else if (!data?.configured) {
        toast.error('Generate credentials or paste all three secrets before saving');
        setSaving(false);
        return;
      }

      const updated = await api.settings.floatIntegration.update(body);
      setData(updated);
      setApiKey('');
      setHmacSecret('');
      setEncryptionKey('');
      toast.success('Partner integration saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    const ok = window.confirm(
      'Generate new API credentials? Existing PrixBI configuration will stop working until you update it with the new values.'
    );
    if (!ok) return;

    setGenerating(true);
    try {
      const result = await api.settings.floatIntegration.generate();
      setData(result);
      setRevealed(result.credentials);
      setApiKey('');
      setHmacSecret('');
      setEncryptionKey('');
      toast.success('New credentials generated — copy them into PrixBI');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading partner integration…
      </div>
    );
  }

  if (!data) return null;

  const secretPlaceholder = data.configured ? 'Leave blank to keep current' : 'Required';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Partner integration</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Connect PrixBI agent float sync to Terrafi Pro. Credentials are stored per
            organisation and encrypted at rest. Copy the partner org code and secrets into
            PrixBI so each delivery routes to your company.
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded self-start',
            data.configured
              ? 'bg-apsGreenLt text-apsGreen'
              : 'bg-slate-100 text-slate-500'
          )}>
          {data.configured ? 'Configured' : 'Not configured'}
        </span>
      </div>

      {revealed && (
        <div className="mt-4">
          <CredentialsReveal credentials={revealed} onDismiss={() => setRevealed(null)} />
        </div>
      )}

      <div className="mt-5 space-y-4">
        <CopyField
          label="Partner org code (share with PrixBI)"
          value={data.partner_org_code}
        />

        {data.ingest_url && (
          <CopyField label="Partner API URL (for PrixBI)" value={data.ingest_url} />
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">
            PrixBI organization ID
          </label>
          <input
            value={bireportsOrgId}
            onChange={(e) => setBireportsOrgId(e.target.value)}
            placeholder="From PrixBI Agent Float Sync UI"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono"
          />
          <p className="text-[11px] text-slate-500">
            Must match the Organization ID in PrixBI. Sent as{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">
              X-BIReports-Organization-Id
            </code>
            .
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300 text-apsBlue focus:ring-apsBlue"
          />
          <span className="text-sm text-slate-900">Enable float delivery for this organisation</span>
        </label>

        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Credentials
            </p>
            <button
              type="button"
              disabled={generating || saving}
              onClick={generate}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-apsBlue bg-apsBlueLt hover:bg-apsBlue/15 px-3 py-1.5 rounded-md disabled:opacity-50">
              {generating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Generate new credentials
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {data.configured
              ? 'Generate here and paste into PrixBI, or paste PrixBI secrets below to match an existing setup.'
              : 'Generate credentials here, or paste the three values from PrixBI if you already created them there.'}
          </p>
          <SecretField
            label="API key (Bearer)"
            value={apiKey}
            onChange={setApiKey}
            placeholder={secretPlaceholder}
          />
          <SecretField
            label="HMAC secret"
            value={hmacSecret}
            onChange={setHmacSecret}
            placeholder={secretPlaceholder}
          />
          <SecretField
            label="Encryption key (base64, 32 bytes)"
            value={encryptionKey}
            onChange={setEncryptionKey}
            placeholder={secretPlaceholder}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={saving || generating}
          onClick={save}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-apsBlue text-white text-sm font-medium hover:bg-apsBlueMid disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save
        </button>
        <button
          type="button"
          disabled={loading || saving || generating}
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-600 space-y-1">
        <p className="font-medium text-slate-700">In PrixBI Partner integration, set:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>Partner org code → value shown above</li>
          <li>Organization ID → PrixBI org ID you entered here</li>
          <li>Partner API URL → ingest URL above</li>
          <li>All three secrets → same as generated or saved here</li>
        </ul>
      </div>
    </div>
  );
}
