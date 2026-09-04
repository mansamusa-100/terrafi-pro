import React, { useEffect, useMemo, useState } from 'react';
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
  Navigation,
  Eye
} from 'lucide-react';
import { STATUS_META, fmtDalasi } from '../lib/data';
import { cn } from '../lib/utils';
import { ProgressBar } from './ProgressBar';
import { api, Agent, AgentDetail } from '../lib/api';
import { KYC_DOCS, isMultiPageKycDoc } from '../lib/kyc';
import { downloadAuthenticated } from '../lib/download';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { useAppData } from '../lib/data-context';
import { Pencil } from 'lucide-react';
import { AgentOnboardingEdit } from './AgentOnboardingEdit';
import { GoVisitButton } from './GoVisitButton';
import {
  KycDocGallery,
  KycDocThumb,
  toGalleryDocs,
  type GalleryDoc
} from './KycDocGallery';

interface AgentDrawerProps {
  agent: Agent | null;
  onClose: () => void;
}

type Tab = 'overview' | 'kyc' | 'visits';

export function AgentDrawer({ agent, onClose }: AgentDrawerProps) {
  const { user } = useAuth();
  const { users, updateAgent, reviewKyc } = useAppData();
  const canUploadKyc = user ? can(user, 'onboardAgent') : false;
  const canEdit = user ? can(user, 'editAgent') : false;
  const canEditOnboarding =
    user &&
    (can(user, 'editAgent') || can(user, 'editAgentOnboarding'));
  const canReview = user ? can(user, 'reviewKyc') : false;
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
  const [galleryDocs, setGalleryDocs] = useState<GalleryDoc[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
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

  const kycDocs = detail?.kyc_docs ?? [];
  const docsGrouped = useMemo(() => {
    const grouped: Record<string, typeof kycDocs> = {};
    for (const d of kycDocs) {
      (grouped[d.docType] ??= []).push(d);
    }
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => a.id - b.id);
    }
    return grouped;
  }, [kycDocs]);

  const openKycGallery = (docId: number) => {
    if (!agent) return;
    const docs = toGalleryDocs(agent.id, kycDocs);
    if (!docs.length) return;
    const idx = Math.max(0, docs.findIndex((d) => d.id === docId));
    setGalleryDocs(docs);
    setGalleryIndex(idx);
  };

  if (!agent) return null;

  const data = detail || agent;
  const s = STATUS_META[data.status];
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

  const allKycDocsReady = KYC_DOCS.every(
    (d) => (docsGrouped[d.key]?.length ?? 0) >= 1
  );

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
          <div className="relative mb-4">
            <button
              onClick={onClose}
              aria-label="Close agent details"
              className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4 pr-10">
              <div className="flex-1 min-w-0">
                <h2 className="text-white text-xl sm:text-2xl font-bold tracking-tight leading-snug break-words">
                  {data.outlet_name || data.name}
                </h2>
                {data.outlet_name && data.outlet_name !== data.name && (
                  <div className="text-white/70 text-sm mt-1 leading-snug break-words">
                    {data.name}
                  </div>
                )}
                <div className="text-white/50 text-xs mt-1 font-medium">{data.id}</div>
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

              {data.location_photo_url && (
                <figure className="shrink-0 w-32 sm:w-36 rounded-xl overflow-hidden border-2 border-white/25 shadow-lg ring-1 ring-black/10">
                  <img
                    src={data.location_photo_url}
                    alt={`${data.outlet_name || data.name} outlet`}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <figcaption className="sr-only">Outlet location photo</figcaption>
                </figure>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['E-float', fmtDalasi(data.efloat), floatColorClass],
              ['Cash float', fmtDalasi(data.cash), 'text-white/90'],
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

          <GoVisitButton agent={data} variant="ghost" fullWidth className="mt-4" />
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
                {data.outlet_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-28">Outlet</span>
                    <span className="font-medium text-slate-900">{data.outlet_name}</span>
                  </div>
                )}
                {[
                  [MapPin, 'Zone', data.zone],
                  ...(data.town_village
                    ? [[MapPin, 'Town / village', data.town_village] as const]
                    : []),
                  [Phone, 'Business phone', data.phone],
                  ...(data.personal_phone
                    ? [[Phone, 'Personal', data.personal_phone] as const]
                    : []),
                  [User, 'Field officer', data.officer],
                  [Calendar, 'Joined', data.joined],
                  [Clock, 'Last visit', lastVisit],
                  [Navigation, 'GPS', `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`]
                ].map(([Icon, label, value]) => (
                  <div key={label as string} className="flex items-center gap-3 text-sm">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-28">{label as string}</span>
                    {label === 'Personal' && data.personal_phone ? (
                      <a
                        href={`tel:${data.personal_phone.replace(/\s/g, '')}`}
                        className="font-medium text-apsBlue hover:underline">
                        {value as string}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-900">{value as string}</span>
                    )}
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
                    <span className="font-medium text-slate-900">
                      {data.business_type === 'Others' && data.business_type_other
                        ? data.business_type_other
                        : data.business_type}
                    </span>
                  </div>
                )}
                {(data.competitors_present?.length ?? 0) > 0 && (
                  <div className="text-sm">
                    <div className="text-slate-500 mb-1.5">Competitors at location</div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.competitors_present!.map((c) => (
                        <span
                          key={c}
                          className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(data.branding_present?.length ?? 0) > 0 && (
                  <div className="text-sm">
                    <div className="text-slate-500 mb-1.5">Branding at location</div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.branding_present!.map((b) => (
                        <span
                          key={b}
                          className="text-xs font-medium px-2 py-0.5 rounded-full bg-apsGreenLt text-apsGreen">
                          {b}
                        </span>
                      ))}
                    </div>
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

              {canEditOnboarding && (
                <AgentOnboardingEdit
                  agent={data}
                  onUpdated={(updated) => {
                    setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
                  }}
                />
              )}

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
                Tap a document to preview. Use next/previous in the viewer to
                move through all KYC files quickly.
              </p>
              {KYC_DOCS.map((doc) => {
                const pages = docsGrouped[doc.key] ?? [];
                const uploaded = pages[pages.length - 1];
                const multiPage = isMultiPageKycDoc(doc.key);

                return (
                  <div
                    key={doc.key}
                    className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {pages.length > 0 ? (
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
                          {pages.length > 0 ? (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {multiPage
                                ? `${pages.length} page${pages.length === 1 ? '' : 's'} uploaded`
                                : uploaded.fileName}
                            </div>
                          ) : (
                            <div className="text-xs text-apsAmber mt-0.5">
                              Not uploaded
                            </div>
                          )}
                        </div>
                      </div>
                      {canUploadKyc && !multiPage && (
                        <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-apsBlue text-white text-xs font-medium hover:bg-apsBlueMid cursor-pointer shrink-0">
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

                    {pages.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {pages.map((page, index) => (
                          <div key={page.id} className="space-y-1.5">
                            <KycDocThumb
                              doc={{
                                id: page.id,
                                title: multiPage
                                  ? `${doc.label} · page ${index + 1}`
                                  : doc.label,
                                fileName: page.fileName,
                                mimeType: page.mimeType,
                                url: page.url,
                                agentId: agent.id
                              }}
                              onOpen={() => openKycGallery(page.id)}
                            />
                            <div className="flex items-center justify-between gap-2 px-0.5">
                              <button
                                type="button"
                                onClick={() => openKycGallery(page.id)}
                                className="text-[10px] font-medium text-apsBlue hover:underline inline-flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownload(page.id, page.fileName)
                                }
                                className="text-[10px] font-medium text-slate-600 hover:underline inline-flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canUploadKyc && multiPage && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-apsBlue text-white text-xs font-medium hover:bg-apsBlueMid cursor-pointer">
                          {uploading === doc.key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          Add page
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading === doc.key}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(doc.key, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          Upload PDF
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            disabled={uploading === doc.key}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(doc.key, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    )}
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

      {galleryDocs && (
        <KycDocGallery
          docs={galleryDocs}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryDocs(null)}
        />
      )}
    </>
  );
}
