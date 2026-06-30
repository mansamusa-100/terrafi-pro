import React, { useState } from 'react';
import { UserPlus, Shield, X, Pencil } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { ROLE_META, Role, can } from '../lib/rbac';
import { avatarColor, initials } from '../lib/data';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ApiError, CompanyUser } from '../lib/api';

const ROLE_BADGE: Record<string, string> = {
  system_owner: 'bg-navy text-white',
  platform_staff: 'bg-indigo-100 text-indigo-700',
  manager: 'bg-apsBlueLt text-apsBlue',
  internal: 'bg-purple-100 text-purple-700',
  adr: 'bg-apsAmberLt text-amber-700',
  agent: 'bg-apsTealLt text-apsTeal',
  teller: 'bg-slate-100 text-slate-600'
};

const PLATFORM_INVITE_ROLES: Role[] = ['platform_staff'];
const COMPANY_INVITE_ROLES: Role[] = [
  'manager',
  'internal',
  'adr',
  'agent',
  'teller'
];

export function UsersPage() {
  const { user } = useAuth();
  const { users, updateUserRole, inviteUser, updateUser } = useAppData();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', zone: '', status: 'active' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'platform_staff' as Role,
    zone: ''
  });
  const [inviting, setInviting] = useState(false);

  const isPlatform =
    user?.role === 'system_owner' || user?.role === 'platform_staff';
  const canInvite =
    user &&
    (can(user.role, 'managePlatformUsers') ||
      can(user.role, 'manageCompanyUsers'));
  const canEditUsers =
    user && !isPlatform && can(user.role, 'editUsers');
  const inviteRoles = isPlatform ? PLATFORM_INVITE_ROLES : COMPANY_INVITE_ROLES;
  const editableRoles = isPlatform ? PLATFORM_INVITE_ROLES : COMPANY_INVITE_ROLES;

  const openEdit = (u: CompanyUser) => {
    setEditTarget(u);
    setEditForm({
      name: u.name,
      zone: u.zone || '',
      status: u.status
    });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await updateUser(editTarget.email, {
        name: editForm.name.trim(),
        zone: editForm.zone.trim(),
        status: editForm.status
      });
      toast.success('User updated');
      setEditTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const changeRole = (email: string, role: string) => {
    updateUserRole(email, role);
    toast.success('Role updated', {
      description: `${email} is now ${ROLE_META[role as Role].label}`
    });
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const created = await inviteUser({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        zone: inviteForm.zone.trim() || undefined
      });
      toast.success('User invited', {
        description: created.temporaryPassword
          ? `${created.email} — temp password: ${created.temporaryPassword}`
          : created.email
      });
      setInviteOpen(false);
      setInviteForm({
        name: '',
        email: '',
        role: isPlatform ? 'platform_staff' : 'internal',
        zone: ''
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page-pad">
      <div className="metric-grid mb-6">
        <MetricCard
          label="Total users"
          value={users.length}
          icon={<Shield className="w-5 h-5" />}
          accent="#1565C0"
        />
        {isPlatform ? (
          <MetricCard
            label="Platform staff"
            value={counts['platform_staff'] || 0}
            icon={<Shield className="w-5 h-5" />}
            accent="#00897B"
          />
        ) : (
          <MetricCard
            label="Managers"
            value={counts['manager'] || 0}
            icon={<Shield className="w-5 h-5" />}
            accent="#00897B"
          />
        )}
        <MetricCard
          label="ADRs / officers"
          value={counts['adr'] || 0}
          icon={<Shield className="w-5 h-5" />}
          accent="#F59E0B"
        />
        <MetricCard
          label="Internal users"
          value={counts['internal'] || 0}
          icon={<Shield className="w-5 h-5" />}
          accent="#6D28D9"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {isPlatform ? 'Platform users' : 'Company users & roles'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isPlatform
                ? 'Invite platform staff only — companies register themselves'
                : 'Invite users within your organisation'}
            </p>
          </div>
          {canInvite && (
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-navy text-white text-xs font-medium hover:bg-navyMid transition-colors">
              <UserPlus className="w-4 h-4" />
              Invite user
            </button>
          )}
        </div>

        <div
          className={cn(
            'grid gap-4 pb-3 mb-2 border-b border-slate-200',
            canEditUsers
              ? 'grid-cols-[2fr_1.5fr_1.5fr_1fr_0.5fr]'
              : 'grid-cols-[2fr_1.5fr_1.5fr_1fr]'
          )}>
          {[...['User', 'Zone / scope', 'Role', 'Status'], ...(canEditUsers ? [''] : [])].map(
            (h, i) => (
              <div
                key={h || `col-${i}`}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {h}
              </div>
            )
          )}
        </div>

        {users.map((u) => {
          const ac = avatarColor(u.name);
          const roleLocked = u.role === 'system_owner';
          return (
            <div
              key={u.email}
              className={cn(
                'grid gap-4 py-3 border-b border-slate-100 last:border-0 items-center',
                canEditUsers
                  ? 'grid-cols-[2fr_1.5fr_1.5fr_1fr_0.5fr]'
                  : 'grid-cols-[2fr_1.5fr_1.5fr_1fr]'
              )}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                    ac.bg,
                    ac.text
                  )}>
                  {initials(u.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {u.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {u.email}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-600">{u.zone || '—'}</div>
              <div>
                {roleLocked ? (
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                      ROLE_BADGE[u.role]
                    )}>
                    {ROLE_META[u.role as Role].label}
                  </span>
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.email, e.target.value)}
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full border-none outline-none cursor-pointer appearance-none',
                      ROLE_BADGE[u.role]
                    )}>
                    {editableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <span
                className={cn(
                  'text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit border capitalize',
                  u.status === 'active'
                    ? 'bg-apsGreenLt text-apsGreen border-apsGreen/20'
                    : 'bg-apsAmberLt text-amber-700 border-apsAmber/20'
                )}>
                {u.status}
              </span>
              {canEditUsers && u.role !== 'manager' && (
                <button
                  type="button"
                  title="Edit user"
                  onClick={() => openEdit(u)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Invite {isPlatform ? 'platform' : 'company'} user
              </h3>
              <button
                onClick={() => setInviteOpen(false)}
                className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={submitInvite} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Full name
                </label>
                <input
                  required
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((f) => ({
                      ...f,
                      role: e.target.value as Role
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue">
                  {inviteRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
              </div>
              {!isPlatform && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    Zone (optional)
                  </label>
                  <input
                    value={inviteForm.zone}
                    onChange={(e) =>
                      setInviteForm((f) => ({ ...f, zone: e.target.value }))
                    }
                    placeholder="e.g. Greater Banjul"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={inviting}
                className="w-full py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navyMid disabled:opacity-60">
                {inviting ? 'Sending invite…' : 'Send invite'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Edit {ROLE_META[editTarget.role as Role].label}
              </h3>
              <button
                type="button"
                title="Close"
                onClick={() => setEditTarget(null)}
                className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Full name
                </label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Zone
                </label>
                <input
                  value={editForm.zone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, zone: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={savingEdit}
                className="w-full py-2.5 rounded-lg bg-navy text-white text-sm font-semibold disabled:opacity-60">
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
