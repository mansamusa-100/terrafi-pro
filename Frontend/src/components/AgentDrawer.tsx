import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Phone,
  User,
  Calendar,
  Clock,
  Shield,
  Wallet,
  FileText,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Navigation
} from 'lucide-react';
import { STATUS_META, avatarColor, initials, fmt } from '../lib/data';
import { cn } from '../lib/utils';
import { ProgressBar } from './ProgressBar';
import { api, Agent, AgentDetail } from '../lib/api';
import { KYC_DOCS } from '../lib/kyc';
import { downloadAuthenticated } from '../lib/download';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { useAppData } from '../lib/data-context';
import { Pencil } from 'lucide-react';

interface AgentDrawerProps {
  agent: Agent | null;
  onClose: () => void;
}

type Tab = 'overview' | 'kyc' | 'visits';

export function AgentDrawer({ agent, onClose }: AgentDrawerProps) {
  const { user } = useAuth();
  const { users, updateAgent, reviewKyc } = useAppData();
  const canUploadKyc = user ? can(user.role, 'onboardAgent') : false;
  const canEdit = user ? can(user.role, 'editAgent') : false;
  const canReview = user ? can(user.role, 'reviewKyc') : false;
  const adrs = users.filter((u) => u.role === 'adr' && u.id);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    zone: '',
    status: 'active',
    officer_id: ''
  });

  useEffect(() => {
    if (agent) {
      setMounted(false);
      setTab(agent.kyc === 'pending' ? 'kyc' : 'overview');
      setShowReject(false);
      setRejectNote('');
      const t = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(t);
    }
    setDetail(null);
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    setLoading(true);
    api.agents
      .get(agent.id)
      .then(setDetail)
      .catch(() => toast.error('Failed to load agent details'))
      .finally(() => setLoading(false));
  }, [agent?.id]);

  useEffect(() => {
    if (!detail) return;
    setEditForm({
      name: detail.name,
      phone: detail.phone,
      zone: detail.zone,
      status: detail.status,
      officer_id: detail.officer_id || ''
    });
  }, [detail]);

  const saveAgentEdits = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      await updateAgent(agent.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        zone: editForm.zone,
        status: editForm.status,
        officer_id: editForm.officer_id || null
      });
      const refreshed = await api.agents.get(agent.id);
      setDetail(refreshed);
      setEditing(false);
      toast.success('Agent updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (!agent) return null;

  const data = detail || agent;
  const s = STATUS_META[data.status];
  const ac = avatarColor(data.name);
  const lastVisit = data.last_visit ?? 'Never';

  let floatColorClass = 'text-apsGreen';
  let floatBgClass = 'bg-apsGreen';
  if (data.efloat < 5000) {
    floatColorClass = 'text-apsRed';
    floatBgClass = 'bg-apsRed';
  } else if (data.efloat < 20000) {
    floatColorClass = 'text-apsAmber';
    floatBgClass = 'bg-apsAmber';
  }

  const scoreColor =
    data.score >= 80
      ? 'text-apsGreen'
      : data.score >= 60
        ? 'text-apsAmber'
        : 'text-apsRed';
  const floatPct = Math.min(100, Math.round(data.efloat / 100000 * 100));

  const kycDocs = detail?.kyc_docs ?? [];
  const docsByType = Object.fromEntries(
    kycDocs.map((d) => [d.docType, d])
  );
  const allKycDocsReady = KYC_DOCS.every((d) => docsByType[d.key]);

  const handleDownload = async (docId: number, fileName: string) => {
    try {
      await downloadAuthenticated(
        `/agents/${agent.id}/kyc-docs/${docId}/download`,
        fileName
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    }
  };

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType);
    try {
      await api.agents.uploadKyc(agent.id, docType, file);
      const refreshed = await api.agents.get(agent.id);
      setDetail(refreshed);
      toast.success('Document uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'kyc', label: 'KYC documents' },
    { id: 'visits', label: 'Visits' }
  ];

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300',
          mounted ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 w-full sm:w-[520px] bg-white z-50 overflow-y-auto shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          mounted ? 'translate-x-0' : 'translate-x-full'
        )}>
        <div className="bg-gradient-to-br from-navy to-navyMid p-6 shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-4 items-start flex-1 min-w-0">
              <div
                className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 shadow-inner',
                  ac.bg,
                  ac.text
                )}>
                {initials(data.name)}
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-xl font-bold tracking-tight truncate">
                  {data.name}
                </h2>
                <div className="text-white/60 text-sm mt-0.5 font-medium">
                  {data.id}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block mt-2 uppercase tracking-wider',
                    s?.bg,
                    s?.color,
                    'border',
                    s?.border
                  )}>
                  {s?.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['E-float', fmt(data.efloat), floatColorClass],
              ['Cash float', fmt(data.cash), 'text-white/90'],
              ['Score', `${data.score}%`, scoreColor],
              ['Visits (Mo)', String(data.visits), 'text-white/90']
            ].map(([label, value, colorClass]) => (
              <div
                key={label}
                className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] text-white/50 font-medium uppercase tracking-wider mb-1">
                  {label}
                </div>
                <div className={cn('text-lg font-bold', colorClass)}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex border-b border-slate-200 px-4 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-3 text-xs font-semibold border-b-2 transition-colors',
                tab === t.id
                  ? 'border-apsBlue text-apsBlue'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 flex-1">
          {loading && !detail ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading details…
            </div>
          ) : tab === 'overview' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                {[
                  [MapPin, 'Zone', data.zone],
                  [Phone, 'Phone', data.phone],
                  [User, 'Field officer', data.officer],
                  [Calendar, 'Joined', data.joined],
                  [Clock, 'Last visit', lastVisit],
                  [Navigation, 'GPS', `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`]
                ].map(([Icon, label, value]) => (
                  <div key={label as string} className="flex items-center gap-3 text-sm">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-28">{label as string}</span>
                    <span className="font-medium text-slate-900">{value as string}</span>
                  </div>
                ))}
                {data.national_id && (
                  <div className="flex items-center gap-3 text-sm">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-28">National ID</span>
                    <span className="font-medium text-slate-900">{data.national_id}</span>
                  </div>
                )}
                {data.business_type && (
                  <div className="flex items-center gap-3 text-sm">
                    <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-28">Business type</span>
                    <span className="font-medium text-slate-900">{data.business_type}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-500 w-28">KYC status</span>
                  <span
                    className={cn(
                      'font-medium capitalize px-2 py-0.5 rounded text-xs',
                      data.kyc === 'verified'
                        ? 'bg-apsGreenLt text-apsGreen'
                        : data.kyc === 'pending'
                          ? 'bg-apsAmberLt text-apsAmber'
                          : 'bg-apsRedLt text-apsRed'
                    )}>
                    {data.kyc}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Float level
                </div>
                <ProgressBar value={floatPct} color={floatBgClass} height="h-2" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                  <span>D 0</span>
                  <span>D 100,000</span>
                </div>
              </div>

              {canEdit && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Manager edit
                    </h4>
                    {!editing ? (
                      <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1 text-xs font-medium text-apsBlue hover:underline">
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    ) : null}
                  </div>
                  {editing ? (
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="Name"
                      />
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, phone: e.target.value }))
                        }
                        placeholder="Phone"
                      />
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        value={editForm.zone}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, zone: e.target.value }))
                        }
                        placeholder="Zone"
                      />
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        value={editForm.officer_id}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            officer_id: e.target.value
                          }))
                        }>
                        <option value="">Unassigned ADR</option>
                        {adrs.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, status: e.target.value }))
                        }>
                        <option value="active">Active</option>
                        <option value="low_float">Low float</option>
                        <option value="critical">Critical</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={saveAgentEdits}
                          disabled={saving}
                          className="flex-1 py-2 rounded-lg bg-navy text-white text-xs font-semibold disabled:opacity-60">
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                        <button
                          onClick={() => setEditing(false)}
                          className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Reassign ADR, update contact details, or change status.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : tab === 'kyc' ? (
            <div className="space-y-4">
              {data.kyc === 'expired' && data.kyc_review_note && (
                <div className="rounded-lg border border-apsRed/20 bg-apsRedLt/50 px-3 py-2.5 text-xs text-apsRed">
                  <span className="font-semibold">Rejected:</span> {data.kyc_review_note}
                </div>
              )}
              {canReview && data.kyc === 'pending' && allKycDocsReady && (
                <div className="rounded-xl border border-apsAmber/30 bg-apsAmberLt/40 p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-800">
                    Ready for KYC review
                  </p>
                  {!showReject ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={reviewBusy}
                        onClick={async () => {
                          setReviewBusy(true);
                          try {
                            await reviewKyc(agent.id, 'approve');
                            const refreshed = await api.agents.get(agent.id);
                            setDetail(refreshed);
                            toast.success('KYC approved');
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : 'Approval failed'
                            );
                          } finally {
                            setReviewBusy(false);
                          }
                        }}
                        className="flex-1 py-2 rounded-lg bg-apsGreen text-white text-xs font-semibold disabled:opacity-60">
                        Approve KYC
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReject(true)}
                        className="flex-1 py-2 rounded-lg border border-apsRed/30 text-apsRed text-xs font-semibold">
                        Reject
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setReviewBusy(true);
                        try {
                          await reviewKyc(agent.id, 'reject', rejectNote.trim());
                          const refreshed = await api.agents.get(agent.id);
                          setDetail(refreshed);
                          setShowReject(false);
                          setRejectNote('');
                          toast.success('KYC rejected');
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : 'Rejection failed'
                          );
                        } finally {
                          setReviewBusy(false);
                        }
                      }}
                      className="space-y-2">
                      <textarea
                        required
                        rows={2}
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Rejection reason"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={reviewBusy}
                          className="flex-1 py-2 rounded-lg bg-apsRed text-white text-xs font-semibold disabled:opacity-60">
                          Confirm reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReject(false)}
                          className="px-3 py-2 text-xs border border-slate-200 rounded-lg">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500">
                Required documents for KYC completion. Download uploaded files or
                upload missing documents.
              </p>
              {KYC_DOCS.map((doc) => {
                const uploaded = docsByType[doc.key];
                return (
                  <div
                    key={doc.key}
                    className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {uploaded ? (
                          <CheckCircle2 className="w-5 h-5 text-apsGreen shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-apsAmber shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {doc.label}
                            {doc.required && (
                              <span className="text-apsRed ml-1">*</span>
                            )}
                          </div>
                          {uploaded ? (
                            <>
                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {uploaded.fileName}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(uploaded.uploadedAt).toLocaleString()}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-apsAmber mt-0.5">
                              Not uploaded
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {uploaded && (
                          <button
                            onClick={() =>
                              handleDownload(uploaded.id, uploaded.fileName)
                            }
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        )}
                        {canUploadKyc && (
                          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-apsBlue text-white text-xs font-medium hover:bg-apsBlueMid cursor-pointer">
                            {uploading === doc.key ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            {uploaded ? 'Replace' : 'Upload'}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              className="hidden"
                              disabled={uploading === doc.key}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(doc.key, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {detail?.recent_visits?.length ? (
                detail.recent_visits.map((v) => (
                  <div
                    key={v.id}
                    className="border border-slate-200 rounded-xl p-4 text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 capitalize">
                          {v.type} visit
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {v.visit_date} · {v.time} · {v.officer}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                          v.status === 'done'
                            ? 'bg-apsGreenLt text-apsGreen'
                            : 'bg-apsAmberLt text-apsAmber'
                        )}>
                        {v.status}
                      </span>
                    </div>
                    {v.notes && (
                      <p className="text-xs text-slate-600 mt-2">{v.notes}</p>
                    )}
                    {v.gps_verified && (
                      <div className="text-[10px] text-apsGreen mt-2 font-medium">
                        GPS verified check-in
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-12">
                  No visits recorded for this agent yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
