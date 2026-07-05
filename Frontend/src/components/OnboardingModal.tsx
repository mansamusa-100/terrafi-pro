import React, { useState, Fragment } from 'react';
import {
  X,
  Check,
  User,
  FileText,
  MapPin,
  ClipboardCheck,
  Upload,
  Loader2 } from
'lucide-react';
import { toast } from 'sonner';
import { useAppData } from '../lib/data-context';
import type { Agent } from '../lib/api';
import { ApiError } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { LocationPicker } from './LocationPicker';
import { formatCoords } from '../lib/geolocation';
interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    body: Record<string, unknown>,
    kycFiles?: Record<string, File>
  ) => Promise<Agent>;
}
const STEPS = [
{
  id: 0,
  label: 'Profile',
  icon: User
},
{
  id: 1,
  label: 'KYC documents',
  icon: FileText
},
{
  id: 2,
  label: 'GPS location',
  icon: MapPin
},
{
  id: 3,
  label: 'Review',
  icon: ClipboardCheck
}];

const BUSINESS_TYPES = [
'Retail shop',
'Pharmacy',
'Mobile kiosk',
'Supermarket',
'Standalone agent booth'];

const KYC_DOCS = [
{
  key: 'nationalId',
  label: 'National ID card',
  required: true
},
{
  key: 'businessPermit',
  label: 'Business permit',
  required: true
},
{
  key: 'agentAgreement',
  label: 'Signed agent agreement',
  required: true
}];

export function OnboardingModal({ open, onClose, onSubmit }: OnboardingModalProps) {
  const { zones, users } = useAppData();
  const { user } = useAuth();
  const isManager = user ? can(user.role, 'editAgent') : false;
  const adrs = users.filter((u) => u.role === 'adr' && u.id);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Profile
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+220 ');
  const [nationalId, setNationalId] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [zone, setZone] = useState('');
  const [officerId, setOfficerId] = useState('');
  // KYC
  const [docs, setDocs] = useState<Record<string, File | null>>({});
  // GPS
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  if (!open) return null;
  const reset = () => {
    setStep(0);
    setName('');
    setPhone('+220 ');
    setNationalId('');
    setBusinessType('');
    setZone('');
    setOfficerId('');
    setDocs({});
    setCoords(null);
    setSubmitting(false);
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const profileValid =
  name.trim().length > 1 &&
  phone.trim().length > 5 &&
  nationalId.trim().length > 3 &&
  businessType &&
  zone;
  const kycValid = KYC_DOCS.filter((d) => d.required).every((d) => docs[d.key]);
  const gpsValid = !!coords;
  const canAdvance =
  step === 0 ?
  profileValid :
  step === 1 ?
  kycValid :
  step === 2 ?
  gpsValid :
  true;
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const kycFiles = Object.fromEntries(
        Object.entries(docs).filter(([, file]) => file) as [string, File][]
      );
      await onSubmit(
        {
          name,
          phone,
          zone,
          lat: coords?.lat,
          lng: coords?.lng,
          businessType,
          nationalId,
          ...(isManager && officerId ? { officer_id: officerId } : {})
        },
        kycFiles
      );
      toast.success(`${name} onboarded`, {
        description: 'Agent registered — KYC pending review'
      });
      handleClose();
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : 'Failed to register agent'
      );
    } finally {
      setSubmitting(false);
    }
  };
  const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20 transition-all placeholder:text-slate-400';
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1.5 block';
  return (
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity" />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-navy to-navyMid px-6 py-5 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-white text-lg font-bold tracking-tight">
                  Onboard new agent
                </h2>
                <p className="text-white/60 text-xs mt-0.5">
                  Complete all steps to register an APS WALLET agent
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center mt-5">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const current = i === step;
                return (
                  <Fragment key={s.id}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                          done ?
                          'bg-apsGreen text-white' :
                          current ?
                          'bg-apsBlue text-white' :
                          'bg-white/10 text-white/40'
                        )}>
                        
                        {done ?
                        <Check className="w-4 h-4" /> :

                        <Icon className="w-4 h-4" />
                        }
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-medium whitespace-nowrap',
                          current ? 'text-white' : 'text-white/40'
                        )}>
                        
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 &&
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors',
                        i < step ? 'bg-apsGreen' : 'bg-white/10'
                      )} />

                    }
                  </Fragment>);

              })}
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {step === 0 &&
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>Full name</label>
                  <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fatou Jallow" />
                
                </div>
                <div>
                  <label className={labelClass}>Phone number</label>
                  <input
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+220 7XX XXXX" />
                
                </div>
                <div>
                  <label className={labelClass}>National ID number</label>
                  <input
                  className={inputClass}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="e.g. 0123456789" />
                
                </div>
                <div>
                  <label className={labelClass}>Business type</label>
                  <select
                  className={inputClass}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}>
                  
                    <option value="">Select…</option>
                    {BUSINESS_TYPES.map((b) =>
                  <option key={b} value={b}>
                        {b}
                      </option>
                  )}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Assigned zone</label>
                  <select
                  className={inputClass}
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}>
                  
                    <option value="">Select…</option>
                    {zones.map((z) =>
                  <option key={z} value={z}>
                        {z}
                      </option>
                  )}
                  </select>
                </div>
                {isManager && (
                  <div>
                    <label className={labelClass}>Assign to ADR</label>
                    <select
                      className={inputClass}
                      value={officerId}
                      onChange={(e) => setOfficerId(e.target.value)}>
                      <option value="">Unassigned</option>
                      {adrs.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.zone || 'No zone'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            }

            {step === 1 &&
            <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Upload clear photos of each required document. All three are
                  mandatory for KYC.
                </p>
                {KYC_DOCS.map((d) => {
                const uploaded = docs[d.key];
                return (
                  <label
                    key={d.key}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-colors text-left cursor-pointer',
                      uploaded ?
                      'border-apsGreen bg-apsGreenLt/40' :
                      'border-slate-200 hover:border-apsBlue hover:bg-slate-50'
                    )}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDocs((prev) => ({ ...prev, [d.key]: file }));
                      }} />
                    
                      <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        uploaded ?
                        'bg-apsGreen text-white' :
                        'bg-slate-100 text-slate-400'
                      )}>
                      
                        {uploaded ?
                      <Check className="w-5 h-5" /> :

                      <Upload className="w-5 h-5" />
                      }
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">
                          {d.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {uploaded ?
                        `${uploaded.name} · tap to replace` :
                        'Tap to upload photo or PDF'}
                        </div>
                      </div>
                      {d.required &&
                    <span className="text-[10px] font-semibold text-apsRed uppercase tracking-wider">
                          Required
                        </span>
                    }
                    </label>);

              })}
              </div>
            }

            {step === 2 &&
            <div className="py-2">
                <p className="text-xs text-slate-500 text-center mb-4">
                  Set the agent&apos;s shop location. Use device GPS or tap/drag the
                  pin on the map.
                </p>
                <LocationPicker
                  value={coords}
                  onChange={setCoords}
                  autoCapture
                  mapHeightClass="h-56"
                />
              </div>
            }

            {step === 3 &&
            <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {[
                ['Full name', name],
                ['Phone', phone],
                ['National ID', nationalId],
                ['Business type', businessType],
                ['Zone', zone],
                [
                'GPS',
                coords ? formatCoords(coords) : '—']].

                map(([k, v]) =>
                <div
                  key={k}
                  className="flex justify-between px-4 py-2.5 text-sm">
                  
                      <span className="text-slate-500">{k}</span>
                      <span className="font-medium text-slate-900">{v}</span>
                    </div>
                )}
                </div>
                <div className="flex items-center gap-2 text-xs text-apsGreen bg-apsGreenLt/50 border border-apsGreen/20 rounded-lg px-3 py-2.5">
                  <Check className="w-4 h-4 shrink-0" />
                  All {KYC_DOCS.length} KYC documents uploaded and ready for
                  review
                </div>
              </div>
            }
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              onClick={() => step === 0 ? handleClose() : setStep(step - 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < STEPS.length - 1 ?
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance}
              className="px-5 py-2 rounded-lg bg-apsBlue hover:bg-apsBlueMid text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              
                Continue
              </button> :

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-apsGreen hover:bg-green-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60">
              
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Registering…' : 'Register agent'}
              </button>
            }
          </div>
        </div>
      </div>
    </>);

}