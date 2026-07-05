import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Crosshair,
  Loader2,
  Check,
  Camera,
  CheckCircle2 } from
'lucide-react';
import { toast } from 'sonner';
import { fmt } from '../lib/data';
import { useAppData } from '../lib/data-context';
import type { Agent } from '../lib/api';
import { ApiError } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import {
  captureDeviceLocation,
  verifyGpsCheckIn,
  GPS_VERIFY_RADIUS_M
} from '../lib/geolocation';
import { isBrowserOnline } from '../lib/offline-visits';
import { GoVisitButton } from './GoVisitButton';
interface VisitLogModalProps {
  open: boolean;
  onClose: () => void;
  presetAgentId?: string;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
}
const VISIT_TYPES = [
'Float check',
'Branding audit',
'KYC renewal',
'Equipment check',
'Issue follow-up'];

const BASE_COMPLIANCE_ITEMS = [
'Agent ID & licence visible to customers',
'KYC documents current and on file',
'Transaction logbook maintained',
'Float reconciles with system records'];

const EQUIPMENT_ITEMS = [
'POS / phone functional',
'Signage in good condition',
'Receipt printer working'];

export function VisitLogModal({
  open,
  onClose,
  presetAgentId,
  onSubmit
}: VisitLogModalProps) {
  const { user } = useAuth();
  const { agents } = useAppData();
  const companyLabel = user?.branding?.title ?? user?.company ?? 'Company';
  const complianceItems = useMemo(
    () => [`${companyLabel} branding clearly displayed`, ...BASE_COMPLIANCE_ITEMS],
    [companyLabel]
  );
  const [agentId, setAgentId] = useState(presetAgentId || '');
  const [visitType, setVisitType] = useState(VISIT_TYPES[0]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInLat, setCheckInLat] = useState<number | null>(null);
  const [checkInLng, setCheckInLng] = useState<number | null>(null);
  const [checkInDistance, setCheckInDistance] = useState<number | null>(null);
  const [captureGpsOk, setCaptureGpsOk] = useState<boolean | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [efloat, setEfloat] = useState('');
  const [cash, setCash] = useState('');
  const [compliance, setCompliance] = useState<Record<string, boolean>>({});
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (open && presetAgentId) setAgentId(presetAgentId);
  }, [open, presetAgentId]);

  useEffect(() => {
    setCheckedIn(false);
    setCheckInLat(null);
    setCheckInLng(null);
    setCheckInDistance(null);
    setCaptureGpsOk(null);
    setCapturedAt(null);
  }, [agentId]);
  if (!open) return null;
  const agent = agents.find((a) => a.id === agentId);
  const reset = () => {
    setAgentId(presetAgentId || '');
    setVisitType(VISIT_TYPES[0]);
    setCheckedIn(false);
    setCheckingIn(false);
    setCheckInLat(null);
    setCheckInLng(null);
    setCheckInDistance(null);
    setCaptureGpsOk(null);
    setCapturedAt(null);
    setEfloat('');
    setCash('');
    setCompliance({});
    setEquipment({});
    setPhotos({});
    setNotes('');
    setSubmitting(false);
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const checkIn = async () => {
    if (!agent) {
      toast.error('Select an agent first');
      return;
    }
    setCheckingIn(true);
    try {
      const { lat, lng } = await captureDeviceLocation();
      const gps = verifyGpsCheckIn(agent.lat, agent.lng, lat, lng);
      setCheckInLat(lat);
      setCheckInLng(lng);
      setCheckInDistance(gps.distanceMeters);
      setCaptureGpsOk(gps.verified);
      setCapturedAt(new Date().toISOString());
      setCheckedIn(true);

      if (gps.verified) {
        toast.success('GPS check-in OK', {
          description: `${gps.distanceMeters}m from ${agent.name} (within ${GPS_VERIFY_RADIUS_M}m)`
        });
      } else {
        toast.warning('You appear far from the agent', {
          description: `${gps.distanceMeters ?? '?'}m away (max ${GPS_VERIFY_RADIUS_M}m). Recheck in at the shop or this visit may fail to sync.`
        });
      }
    } catch (err) {
      toast.error('GPS check-in failed', {
        description: err instanceof Error ? err.message : 'Could not get location'
      });
    } finally {
      setCheckingIn(false);
    }
  };
  const compliancePassed = complianceItems.filter((i) => compliance[i]).length;
  const canSubmit =
    agentId && checkedIn && checkInLat != null && checkInLng != null && efloat.trim() !== '';
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = (await onSubmit({
        agentId,
        type: visitType,
        efloat: parseInt(efloat, 10),
        cash: cash ? parseInt(cash, 10) : undefined,
        notes,
        compliancePassed: compliancePassed,
        complianceTotal: complianceItems.length,
        checkInLat,
        checkInLng,
        capturedAt,
        captureDistance: checkInDistance,
        gpsOkAtCapture: captureGpsOk === true
      })) as { distance_meters?: number; offlineQueued?: boolean };

      if (result?.offlineQueued) {
        const offlineNote = !isBrowserOnline()
          ? 'Will sync when you have network — GPS was captured at the agent.'
          : 'Saved locally — will sync shortly.';
        toast.success('Visit saved offline', {
          description: `${agent?.name || 'Agent'} · ${offlineNote}`
        });
      } else {
        if (result?.distance_meters != null) {
          setCheckInDistance(result.distance_meters);
        }
        toast.success('Visit logged', {
          description: `${agent?.name || 'Agent'} · ${compliancePassed}/${complianceItems.length} compliance checks passed`
        });
      }
      handleClose();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to log visit'
      );
    } finally {
      setSubmitting(false);
    }
  };
  const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20 transition-all placeholder:text-slate-400';
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1.5 block';
  const Toggle = ({
    label,
    on,
    onClick




  }: {label: string;on: boolean;onClick: () => void;}) =>
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 py-2 text-left group">
    
      <span
      className={cn(
        'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
        on ?
        'bg-apsGreen border-apsGreen text-white' :
        'border-slate-300 group-hover:border-apsBlue'
      )}>
      
        {on && <Check className="w-3.5 h-3.5" />}
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </button>;

  return (
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-navy to-navyMid px-6 py-5 shrink-0 flex items-start justify-between">
            <div>
              <h2 className="text-white text-lg font-bold tracking-tight">
                Log field visit
              </h2>
              <p className="text-white/60 text-xs mt-0.5">
                Record float, compliance, and equipment for this visit
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
              
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* Agent + type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Agent</label>
                <select
                  className={inputClass}
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}>
                  
                  <option value="">Select agent…</option>
                  {agents.map((a) =>
                  <option key={a.id} value={a.id}>
                      {a.name} ({a.id})
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className={labelClass}>Visit type</label>
                <select
                  className={inputClass}
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}>
                  
                  {VISIT_TYPES.map((t) =>
                  <option key={t} value={t}>
                      {t}
                    </option>
                  )}
                </select>
              </div>
            </div>

            {agent && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-apsBlue/20 bg-apsBlueLt/30 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {agent.outlet_name || agent.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {agent.zone}
                    {agent.town_village ? ` · ${agent.town_village}` : ''}
                  </div>
                </div>
                <GoVisitButton agent={agent} variant="outline" />
              </div>
            )}

            {/* GPS check-in */}
            <div
              className={cn(
                'rounded-xl border p-4 flex items-center gap-4',
                !checkedIn
                  ? 'border-slate-200 bg-slate-50'
                  : captureGpsOk
                    ? 'border-apsGreen/30 bg-apsGreenLt/40'
                    : 'border-apsAmber/40 bg-apsAmberLt/40'
              )}>
              
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  !checkedIn
                    ? 'bg-white text-slate-400 border border-slate-200'
                    : captureGpsOk
                      ? 'bg-apsGreen text-white'
                      : 'bg-apsAmber text-white'
                )}>
                
                {checkedIn ?
                <CheckCircle2 className="w-5 h-5" /> :

                <Crosshair className="w-5 h-5" />
                }
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  GPS visit verification
                </div>
                <div className="text-xs text-slate-500">
                  {checkedIn ? (
                    checkInDistance != null ? (
                      captureGpsOk ? (
                        <>
                          Verified at capture · {checkInDistance}m from agent
                          {capturedAt && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              GPS locked{' '}
                              {new Date(capturedAt).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {!isBrowserOnline() && ' · offline queue'}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-amber-800 font-medium">
                            {checkInDistance}m from agent — over {GPS_VERIFY_RADIUS_M}m limit
                          </span>
                          <span className="block text-[10px] text-amber-700 mt-0.5">
                            Move closer and tap Check in again before leaving
                          </span>
                        </>
                      )
                    ) : (
                      'GPS captured'
                    )
                  ) : (
                    'Check in while at the agent — coordinates are saved for later sync'
                  )}
                </div>
              </div>
              {checkedIn && !captureGpsOk && (
                <button
                  type="button"
                  onClick={() => {
                    setCheckedIn(false);
                    setCheckInLat(null);
                    setCheckInLng(null);
                    setCheckInDistance(null);
                    setCaptureGpsOk(null);
                    setCapturedAt(null);
                  }}
                  className="text-xs font-medium text-apsBlue hover:underline shrink-0">
                  Recheck
                </button>
              )}
              {!checkedIn && (
                <button
                  onClick={checkIn}
                  disabled={checkingIn || !agentId}
                  className="flex items-center gap-2 bg-apsBlue hover:bg-apsBlueMid text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  {checkingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                  {checkingIn ? 'Checking…' : 'Check in'}
                </button>
              )}
            </div>

            {/* Float reporting */}
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                Float reporting
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>E-float balance (D)</label>
                  <input
                    className={inputClass}
                    value={efloat}
                    onChange={(e) =>
                    setEfloat(e.target.value.replace(/[^0-9]/g, ''))
                    }
                    placeholder={agent ? String(agent.efloat) : '0'}
                    inputMode="numeric" />
                  
                </div>
                <div>
                  <label className={labelClass}>Cash float (D)</label>
                  <input
                    className={inputClass}
                    value={cash}
                    onChange={(e) =>
                    setCash(e.target.value.replace(/[^0-9]/g, ''))
                    }
                    placeholder={agent ? String(agent.cash) : '0'}
                    inputMode="numeric" />
                  
                </div>
              </div>
              {agent && efloat &&
              <div className="text-[11px] text-slate-500 mt-1.5">
                  System record: {fmt(agent.efloat)} e-float · {fmt(agent.cash)}{' '}
                  cash
                </div>
              }
            </div>

            {/* Compliance checklist */}
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                Compliance checklist
              </div>
              <div className="divide-y divide-slate-50">
                {complianceItems.map((item) =>
                <Toggle
                  key={item}
                  label={item}
                  on={!!compliance[item]}
                  onClick={() =>
                  setCompliance((p) => ({
                    ...p,
                    [item]: !p[item]
                  }))
                  } />

                )}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                Equipment check
              </div>
              <div className="divide-y divide-slate-50">
                {EQUIPMENT_ITEMS.map((item) =>
                <Toggle
                  key={item}
                  label={item}
                  on={!!equipment[item]}
                  onClick={() =>
                  setEquipment((p) => ({
                    ...p,
                    [item]: !p[item]
                  }))
                  } />

                )}
              </div>
            </div>

            {/* Photos */}
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                Photo capture
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['Branding & signage', 'Agent storefront'].map((label) => {
                  const taken = photos[label];
                  return (
                    <button
                      key={label}
                      onClick={() =>
                      setPhotos((p) => ({
                        ...p,
                        [label]: !p[label]
                      }))
                      }
                      className={cn(
                        'h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors',
                        taken ?
                        'border-apsGreen bg-apsGreenLt/40 text-apsGreen' :
                        'border-slate-200 text-slate-400 hover:border-apsBlue hover:text-apsBlue'
                      )}>
                      
                      {taken ?
                      <Check className="w-5 h-5" /> :

                      <Camera className="w-5 h-5" />
                      }
                      <span className="text-[11px] font-medium">{label}</span>
                    </button>);

                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>Issues & notes</label>
              <textarea
                className={cn(inputClass, 'resize-none h-20')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Customer issues, observations, follow-up actions…" />
              
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500">
              {compliancePassed}/{complianceItems.length} compliance checks
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="px-5 py-2 rounded-lg bg-apsGreen hover:bg-green-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Saving…' : 'Submit visit log'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>);

}