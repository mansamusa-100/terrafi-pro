import React, { useEffect, useState } from 'react';
import {
  X,
  Building2,
  Users,
  CreditCard,
  ScrollText,
  Loader2,
  Ban,
  CheckCircle2,
  KeyRound,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, CompanyDetail } from '../lib/api';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { can, ROLE_META } from '../lib/rbac';
import { cn } from '../lib/utils';

interface CompanyDrawerProps {
  companyId: string | null;
  onClose: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-apsGreenLt text-apsGreen border-apsGreen/20',
  suspended: 'bg-apsRedLt text-apsRed border-apsRed/20'
};

const SUB_STYLE: Record<string, string> = {
  ACTIVE: 'text-apsGreen',
  TRIALING: 'text-apsBlue',
  PAST_DUE: 'text-apsAmber',
  EXPIRED: 'text-apsRed',
  CANCELLED: 'text-slate-500'
};

const LOCK_STYLE: Record<string, string> = {
  open: 'text-apsGreen',
  grace: 'text-apsAmber',
  locked: 'text-apsRed'
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function formatShort(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function CompanyDrawer({ companyId, onClose }: CompanyDrawerProps) {
  const { user } = useAuth();
  const { updateCompanyStatus, resetUserPassword } = useAppData();
  const canManageStatus = user ? can(user, 'manageCompanyStatus') : false;
  const canResetManagerPassword = user?.role === 'system_owner';
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setDetail(null);
      return;
    }
    setMounted(false);
    setLoading(true);
    api.companies
      .get(companyId)
      .then(setDetail)
      .catch(() => toast.error('Failed to load company'))
      .finally(() => setLoading(false));
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, [companyId]);

  if (!companyId) return null;

  const toggleStatus = async () => {
    if (!detail) return;
    const next = detail.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    try {
      await updateCompanyStatus(detail.id, next);
      const refreshed = await api.companies.get(detail.id);
      setDetail(refreshed);
      toast.success(
        next === 'suspended' ? 'Company suspended' : 'Company reactivated',
        { description: detail.name }
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const resetManagerPassword = async (managerEmail: string, managerName: string) => {
    if (!detail) return;
    if (
      !window.confirm(
        `Reset password for ${managerName} (${managerEmail}) at ${detail.name}?\n\nA temporary password will be generated — share it with them so they can sign in and set a new one.`
      )
    ) {
      return;
    }
    setResettingEmail(managerEmail);
    try {
      const result = await resetUserPassword(managerEmail, {
        companyId: detail.id
      });
      toast.success('Manager password reset', {
        description: result.credentialDelivery === 'email'
          ? `${result.email} — emailed. Copy from Notification report if needed`
          : result.temporaryPassword
            ? `${result.email} — temp password: ${result.temporaryPassword}${
                result.credentialDelivery === 'log_only'
                  ? ' (also logged in Notification report)'
                  : ''
              }`
            : result.message || result.email,
        duration: 15000
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Password reset failed');
    } finally {
      setResettingEmail(null);
    }
  };

  const pulse = detail?.pulse;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/30 z-40"
      />
      <div
        className={cn(
          'fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300',
          mounted ? 'translate-x-0' : 'translate-x-full'
        )}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-apsBlue shrink-0" />
              <h2 className="text-base font-semibold text-slate-900 truncate">
                {detail?.name || 'Company'}
              </h2>
            </div>
            {detail && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {detail.id} · {detail.contactEmail || 'No contact email'}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : detail ? (
            <>
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize',
                    STATUS_STYLE[detail.status] || 'bg-slate-100 text-slate-600'
                  )}>
                  {detail.status}
                </span>
                {detail.subscription?.status && (
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100',
                      SUB_STYLE[detail.subscription.status] || 'text-slate-600'
                    )}>
                    {detail.subscription.status.replace(/_/g, ' ')}
                  </span>
                )}
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 capitalize',
                    LOCK_STYLE[
                      detail.lockState || detail.subscription?.lockState || 'open'
                    ]
                  )}>
                  {detail.lockState || detail.subscription?.lockState || 'open'}
                </span>
              </div>

              {detail.attentionReasons && detail.attentionReasons.length > 0 && (
                <div className="rounded-lg border border-apsAmber/30 bg-apsAmberLt/40 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                    Needs attention
                  </p>
                  <p className="text-xs text-amber-900">
                    {detail.attentionReasons.map((r) => r.label).join(' · ')}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Agents', detail.agentCount ?? detail.agents],
                  ['Users', detail.userCount ?? 0],
                  ['Visits', detail.visitCount ?? 0],
                  ['Seats', detail.seats || detail.plan]
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {label}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {pulse && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Network pulse
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-500 uppercase">
                        Visits (7d)
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        {pulse.visits7d}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-500 uppercase">
                        KYC pending
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        {pulse.kycPending}
                      </div>
                    </div>
                  </div>
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Last visit</dt>
                      <dd className="font-medium text-slate-900 text-right">
                        {formatShort(pulse.lastVisitAt)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Last agent onboarded</dt>
                      <dd className="font-medium text-slate-900 text-right">
                        {formatShort(pulse.lastAgentOnboardedAt)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Last activity</dt>
                      <dd className="font-medium text-slate-900 text-right">
                        {pulse.lastAuditAction
                          ? pulse.lastAuditAction.replace(/\./g, ' · ')
                          : '—'}
                        {pulse.lastAuditAt ? (
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {formatShort(pulse.lastAuditAt)}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Subscription</h3>
                </div>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Provisioned</dt>
                    <dd className="font-medium text-slate-900">
                      {detail.subscription.provisioned ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Plan code</dt>
                    <dd className="font-medium text-slate-900">
                      {detail.subscription.planCode ||
                        detail.subscriptionPlanCode ||
                        '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Monthly amount</dt>
                    <dd className="font-medium text-slate-900">
                      {detail.mrr ? `D ${detail.mrr.toLocaleString()}` : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Billing access</dt>
                    <dd className="font-medium text-slate-900">
                      {detail.subscription.accessAllowed ? 'Allowed' : 'Blocked'}
                    </dd>
                  </div>
                  {detail.registeredAt && (
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Registered</dt>
                      <dd className="font-medium text-slate-900">
                        {formatWhen(detail.registeredAt)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Key users ({detail.users.length})
                  </h3>
                </div>
                {detail.users.length === 0 ? (
                  <p className="text-xs text-slate-500">No users listed.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.users.map((u) => (
                      <div
                        key={u.id || u.email}
                        className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {u.name}
                          </div>
                          <div className="text-slate-500 truncate">{u.email}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-semibold text-slate-600">
                            {ROLE_META[u.role as keyof typeof ROLE_META]?.short ||
                              u.role}
                          </span>
                          {canResetManagerPassword && u.role === 'manager' && (
                            <button
                              type="button"
                              title="Reset manager password"
                              disabled={resettingEmail === u.email}
                              onClick={() =>
                                resetManagerPassword(u.email, u.name)
                              }
                              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50">
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail.recentAudit.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ScrollText className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Recent activity
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {detail.recentAudit.map((e) => (
                      <div
                        key={e.id}
                        className="text-xs border-b border-slate-50 pb-2 last:border-0">
                        <div className="font-medium text-slate-800">
                          {e.action.replace(/\./g, ' · ')}
                        </div>
                        <div className="text-slate-500">
                          {e.actorName} · {formatWhen(e.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canManageStatus && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={toggleStatus}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60',
                    detail.status === 'active'
                      ? 'bg-apsRedLt text-apsRed border border-apsRed/20 hover:bg-apsRed/10'
                      : 'bg-apsGreenLt text-apsGreen border border-apsGreen/20 hover:bg-apsGreen/10'
                  )}>
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : detail.status === 'active' ? (
                    <Ban className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {detail.status === 'active'
                    ? 'Suspend company'
                    : 'Reactivate company'}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">
              Company not found.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
