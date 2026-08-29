import React, { useState, Fragment, useEffect } from 'react';
import {
  X,
  Check,
  User,
  FileText,
  MapPin,
  ClipboardCheck,
  Upload,
  Loader2,
  Tag,
  Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppData } from '../lib/data-context';
import type { Agent, OnboardingConfig } from '../lib/api';
import { ApiError, api } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { LocationPicker } from './LocationPicker';
import { formatCoords } from '../lib/geolocation';
import { AgentCreatedSuccess } from './AgentCreatedSuccess';
import { MultiPageKycCapture } from './MultiPageKycCapture';
import { KYC_DOCS, isMultiPageKycDoc } from '../lib/kyc';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    body: Record<string, unknown>,
    kycFiles?: Record<string, File | File[]>,
    locationPhoto?: File
  ) => Promise<Agent>;
  onCreated?: (agent: Agent) => void;
}

const STEPS = [
  { id: 0, label: 'Profile', icon: User },
  { id: 1, label: 'KYC documents', icon: FileText },
  { id: 2, label: 'Location', icon: MapPin },
  { id: 3, label: 'Branding', icon: Tag },
  { id: 4, label: 'Review', icon: ClipboardCheck }
];

export function OnboardingModal({
  open,
  onClose,
  onSubmit,
  onCreated
}: OnboardingModalProps) {
  const { zones: fallbackZones, users } = useAppData();
  const { user } = useAuth();
  const companyLabel = user?.branding?.title ?? user?.company ?? 'your company';
  const adrs = users.filter((u) => u.role === 'adr' && u.id);
  const isManager = user ? can(user.role, 'editAgent') : false;
  const canAssignAdr =
    user && (can(user.role, 'editAgent') || can(user.role, 'assignAdr'));
  const assignableAdrs =
    user?.role === 'team_lead' && user.supervised_adr_ids?.length
      ? adrs.filter((a) => a.id && user.supervised_adr_ids!.includes(a.id))
      : adrs;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [onboardingConfig, setOnboardingConfig] = useState<OnboardingConfig | null>(
    null
  );

  const [outletName, setOutletName] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+220 ');
  const [personalPhone, setPersonalPhone] = useState('+220 ');
  const [nationalId, setNationalId] = useState('');
  const [gender, setGender] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessTypeOther, setBusinessTypeOther] = useState('');
  const [zone, setZone] = useState('');
  const [townVillage, setTownVillage] = useState('');
  const [officerId, setOfficerId] = useState('');

  const [docs, setDocs] = useState<Record<string, File | null>>({});
  const [agreementPages, setAgreementPages] = useState<File[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPhoto, setLocationPhoto] = useState<File | null>(null);
  const [locationPreview, setLocationPreview] = useState<string | null>(null);

  const [competitors, setCompetitors] = useState<string[]>([]);
  const [branding, setBranding] = useState<string[]>([]);

  const [createdAgent, setCreatedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfigLoading(true);
    api
      .onboardingConfig()
      .then(setOnboardingConfig)
      .catch(() => {
        setOnboardingConfig({
          business_types: [
            'Retail shop',
            'Pharmacy',
            'Mobile kiosk',
            'Supermarket',
            'Standalone agent booth',
            'Others'
          ],
          zone_names: fallbackZones,
          competitor_names: ['Orange Money', 'QMoney', 'Wave', 'Africell Money'],
          branding_types: [
            'Poster',
            'Sticker',
            'Banner',
            'Signboard',
            'Window decal',
            'Branding board'
          ]
        });
      })
      .finally(() => setConfigLoading(false));
  }, [open, fallbackZones]);

  useEffect(() => {
    if (!locationPhoto) {
      setLocationPreview(null);
      return;
    }
    const url = URL.createObjectURL(locationPhoto);
    setLocationPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [locationPhoto]);

  if (!open) return null;

  const businessTypes = onboardingConfig?.business_types ?? [];
  const zoneOptions = onboardingConfig?.zone_names?.length
    ? onboardingConfig.zone_names
    : fallbackZones;
  const competitorOptions = onboardingConfig?.competitor_names ?? [];
  const brandingOptions = onboardingConfig?.branding_types ?? [];

  const reset = () => {
    setStep(0);
    setOutletName('');
    setName('');
    setPhone('+220 ');
    setPersonalPhone('+220 ');
    setNationalId('');
    setGender('');
    setBusinessType('');
    setBusinessTypeOther('');
    setZone('');
    setTownVillage('');
    setOfficerId('');
    setDocs({});
    setAgreementPages([]);
    setCoords(null);
    setLocationPhoto(null);
    setCompetitors([]);
    setBranding([]);
    setSubmitting(false);
    setCreatedAgent(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const finishSuccess = () => {
    if (createdAgent) onCreated?.(createdAgent);
    handleClose();
  };

  const registerAnother = () => {
    setCreatedAgent(null);
    setStep(0);
    setOutletName('');
    setName('');
    setPhone('+220 ');
    setPersonalPhone('+220 ');
    setNationalId('');
    setGender('');
    setBusinessType('');
    setBusinessTypeOther('');
    setZone('');
    setTownVillage('');
    setOfficerId('');
    setDocs({});
    setAgreementPages([]);
    setCoords(null);
    setLocationPhoto(null);
    setCompetitors([]);
    setBranding([]);
    setSubmitting(false);
  };

  const businessTypeValid =
    businessType && (businessType !== 'Others' || businessTypeOther.trim().length > 1);

  const profileValid =
    outletName.trim().length > 1 &&
    name.trim().length > 1 &&
    phone.trim().length > 5 &&
    personalPhone.trim().length > 5 &&
    nationalId.trim().length > 3 &&
    businessTypeValid &&
    zone &&
    townVillage.trim().length > 1 &&
    (!canAssignAdr ||
      user?.role !== 'team_lead' ||
      officerId.length > 0);

  const kycValid = KYC_DOCS.filter((d) => d.required).every((d) =>
    isMultiPageKycDoc(d.key)
      ? agreementPages.length > 0
      : !!docs[d.key]
  );
  const locationValid = !!coords && !!locationPhoto;

  const canAdvance =
    step === 0
      ? profileValid
      : step === 1
        ? kycValid
        : step === 2
          ? locationValid
          : true;

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const kycFiles: Record<string, File | File[]> = {};
      for (const [key, file] of Object.entries(docs)) {
        if (file) kycFiles[key] = file;
      }
      if (agreementPages.length > 0) {
        kycFiles.agentAgreement = agreementPages;
      }
      const agent = await onSubmit(
        {
          outletName: outletName.trim(),
          name: name.trim(),
          phone,
          personalPhone,
          zone,
          townVillage: townVillage.trim(),
          lat: coords?.lat,
          lng: coords?.lng,
          businessType,
          ...(businessType === 'Others'
            ? { businessTypeOther: businessTypeOther.trim() }
            : {}),
          nationalId,
          gender: gender || undefined,
          competitorsPresent: competitors,
          brandingPresent: branding,
          ...(canAssignAdr && officerId ? { officer_id: officerId } : {})
        },
        kycFiles,
        locationPhoto || undefined
      );
      setCreatedAgent(agent);
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : 'Failed to register agent',
        { duration: 6000 }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20 transition-all placeholder:text-slate-400';
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1.5 block';

  const displayBusinessType =
    businessType === 'Others' && businessTypeOther
      ? `Others — ${businessTypeOther}`
      : businessType;

  return (
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden">
          <div className="bg-gradient-to-br from-navy to-navyMid px-6 py-5 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-white text-lg font-bold tracking-tight">
                  {createdAgent ? 'Agent registered' : 'Onboard new agent'}
                </h2>
                <p className="text-white/60 text-xs mt-0.5">
                  {createdAgent
                    ? 'Successfully added to your network'
                    : `Complete all steps to register a ${companyLabel} agent`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={createdAgent ? finishSuccess : handleClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!createdAgent && (
              <div className="flex items-center mt-5 overflow-x-auto pb-1">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done = i < step;
                  const current = i === step;
                  return (
                    <Fragment key={s.id}>
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                            done
                              ? 'bg-apsGreen text-white'
                              : current
                                ? 'bg-apsBlue text-white'
                                : 'bg-white/10 text-white/40'
                          )}>
                          {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <span
                          className={cn(
                            'text-[10px] font-medium whitespace-nowrap',
                            current ? 'text-white' : 'text-white/40'
                          )}>
                          {s.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={cn(
                            'flex-1 min-w-[1.5rem] h-0.5 mx-1 mb-4 rounded-full transition-colors',
                            i < step ? 'bg-apsGreen' : 'bg-white/10'
                          )}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {createdAgent ? (
              <AgentCreatedSuccess
                agent={createdAgent}
                onDone={finishSuccess}
                onRegisterAnother={registerAnother}
              />
            ) : configLoading && step === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading options…
              </div>
            ) : (
              <>
                {step === 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className={labelClass}>Outlet / business name</label>
                      <input
                        className={inputClass}
                        value={outletName}
                        onChange={(e) => setOutletName(e.target.value)}
                        placeholder="e.g. Jallow Mobile Money Shop"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass}>Agent full name</label>
                      <input
                        className={inputClass}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Fatou Jallow"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Gender</label>
                      <select
                        className={inputClass}
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}>
                        <option value="">Select…</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Business phone (float)</label>
                      <input
                        className={inputClass}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+220 7XX XXXX"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Tied to wallet / float account
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>Personal contact</label>
                      <input
                        className={inputClass}
                        value={personalPhone}
                        onChange={(e) => setPersonalPhone(e.target.value)}
                        placeholder="+220 7XX XXXX"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Callable after registration
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>National ID number</label>
                      <input
                        className={inputClass}
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        placeholder="e.g. 0123456789"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Town / village</label>
                      <input
                        className={inputClass}
                        value={townVillage}
                        onChange={(e) => setTownVillage(e.target.value)}
                        placeholder="e.g. Brikama"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Business type</label>
                      <select
                        className={inputClass}
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}>
                        <option value="">Select…</option>
                        {businessTypes.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    {businessType === 'Others' && (
                      <div>
                        <label className={labelClass}>Specify business type</label>
                        <input
                          className={inputClass}
                          value={businessTypeOther}
                          onChange={(e) => setBusinessTypeOther(e.target.value)}
                          placeholder="Type business type"
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>Assigned zone</label>
                      <select
                        className={inputClass}
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}>
                        <option value="">Select…</option>
                        {zoneOptions.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                    {canAssignAdr && (
                      <div>
                        <label className={labelClass}>
                          Assign to ADR
                          {user?.role === 'team_lead' && (
                            <span className="text-apsRed ml-1">*</span>
                          )}
                        </label>
                        <select
                          aria-label="Assign to ADR"
                          className={inputClass}
                          value={officerId}
                          onChange={(e) => setOfficerId(e.target.value)}>
                          <option value="">
                            {user?.role === 'team_lead' ? 'Select ADR…' : 'Unassigned'}
                          </option>
                          {assignableAdrs.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} · {a.zone || 'No zone'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Upload clear photos of each required document. For the signed
                      agreement you can snap multiple pages if it is not a PDF.
                    </p>
                    {KYC_DOCS.map((d) => {
                      if (isMultiPageKycDoc(d.key)) {
                        return (
                          <MultiPageKycCapture
                            key={d.key}
                            label={d.label}
                            pages={agreementPages}
                            onChange={setAgreementPages}
                            required={d.required}
                          />
                        );
                      }
                      const uploaded = docs[d.key];
                      return (
                        <label
                          key={d.key}
                          className={cn(
                            'w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-colors text-left cursor-pointer',
                            uploaded
                              ? 'border-apsGreen bg-apsGreenLt/40'
                              : 'border-slate-200 hover:border-apsBlue hover:bg-slate-50'
                          )}>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setDocs((prev) => ({ ...prev, [d.key]: file }));
                            }}
                          />
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                              uploaded
                                ? 'bg-apsGreen text-white'
                                : 'bg-slate-100 text-slate-400'
                            )}>
                            {uploaded ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <Upload className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">
                              {d.label}
                            </div>
                            <div className="text-xs text-slate-500">
                              {uploaded
                                ? `${uploaded.name} · tap to replace`
                                : 'Tap to snap or upload photo/PDF'}
                            </div>
                          </div>
                          {d.required && (
                            <span className="text-[10px] font-semibold text-apsRed uppercase tracking-wider">
                              Required
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs text-slate-500 text-center mb-4">
                        Set the agent&apos;s shop location. Use device GPS or tap/drag the
                        pin on the map.
                      </p>
                      <LocationPicker
                        value={coords}
                        onChange={setCoords}
                        autoCapture
                        mapHeightClass="h-48"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Location photo</label>
                      <p className="text-xs text-slate-500 mb-3">
                        Take a clear photo of the shop front or outlet. This will be shown
                        on the agent profile after registration.
                      </p>
                      <label
                        className={cn(
                          'block rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors',
                          locationPhoto
                            ? 'border-apsGreen'
                            : 'border-slate-200 hover:border-apsBlue hover:bg-slate-50'
                        )}>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setLocationPhoto(file);
                          }}
                        />
                        {locationPreview ? (
                          <img
                            src={locationPreview}
                            alt="Location preview"
                            className="w-full h-48 object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            <Camera className="w-10 h-10 mb-2" />
                            <span className="text-sm font-medium">Tap to capture or upload</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">
                        Competitors present at location
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        Select any competitor brands visible at this outlet.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {competitorOptions.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleItem(competitors, c, setCompetitors)}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                              competitors.includes(c)
                                ? 'bg-apsBlue text-white border-apsBlue'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-apsBlue/50'
                            )}>
                            {c}
                          </button>
                        ))}
                      </div>
                      {competitorOptions.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          No competitors configured — ask your manager to add them in Settings.
                        </p>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">
                        APS branding at location
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        Select branding materials visible at this outlet.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {brandingOptions.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => toggleItem(branding, b, setBranding)}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                              branding.includes(b)
                                ? 'bg-apsGreen text-white border-apsGreen'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-apsGreen/50'
                            )}>
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    {locationPreview && (
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <img
                          src={locationPreview}
                          alt="Location"
                          className="w-full h-40 object-cover"
                        />
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                      {[
                        ['Outlet', outletName],
                        ['Agent name', name],
                        ['Business phone', phone],
                        ['Personal contact', personalPhone],
                        ['National ID', nationalId],
                        ['Business type', displayBusinessType],
                        ['Zone', zone],
                        ['Town / village', townVillage],
                        ['GPS', coords ? formatCoords(coords) : '—'],
                        [
                          'Competitors',
                          competitors.length ? competitors.join(', ') : 'None noted'
                        ],
                        [
                          'Branding',
                          branding.length ? branding.join(', ') : 'None noted'
                        ]
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between px-4 py-2.5 text-sm gap-4">
                          <span className="text-slate-500 shrink-0">{k}</span>
                          <span className="font-medium text-slate-900 text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-apsGreen bg-apsGreenLt/50 border border-apsGreen/20 rounded-lg px-3 py-2.5">
                      <Check className="w-4 h-4 shrink-0" />
                      All KYC documents ready — agreement has{' '}
                      {agreementPages.length === 1 && agreementPages[0]?.type === 'application/pdf'
                        ? '1 PDF'
                        : `${agreementPages.length} page${agreementPages.length === 1 ? '' : 's'}`}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!createdAgent && !configLoading && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance}
                  className="px-5 py-2 rounded-lg bg-apsBlue hover:bg-apsBlueMid text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-apsGreen hover:bg-green-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Registering…' : 'Register agent'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
