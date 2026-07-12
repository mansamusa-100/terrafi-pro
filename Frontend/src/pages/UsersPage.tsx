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
  team_lead: 'bg-teal-100 text-teal-800',
  adr: 'bg-apsAmberLt text-amber-700',
  agent: 'bg-apsTealLt text-apsTeal',
  teller: 'bg-slate-100 text-slate-600'
};

const PLATFORM_INVITE_ROLES: Role[] = ['platform_staff'];
const COMPANY_INVITE_ROLES: Role[] = [
  'manager',
  'internal',
  'team_lead',
  'adr',
  'agent',
  'teller'
];

const DESKTOP_GRID = 'md:grid-cols-[2fr_1.5fr_1.5fr_1fr_0.5fr]';
const DESKTOP_GRID_NO_EDIT = 'md:grid-cols-[2fr_1.5fr_1.5fr_1fr]';

function zoneLabel(u: CompanyUser) {
  if (u.role === 'team_lead' && u.supervised_adr_ids?.length) {
    return `${u.supervised_adr_ids.length} ADR(s) · ${u.zone || '—'}`;
  }
  return u.zone || '—';
}

function UserRoleControl({
  u,
  roleLocked,
  editableRoles,
  onRoleChange
}: {
  u: CompanyUser;
  roleLocked: boolean;
  editableRoles: Role[];
  onRoleChange: (email: string, role: string) => void;
}) {
  if (roleLocked) {
    return (
      <span
        className={cn(
          'text-[11px] font-semibold px-2.5 py-1 rounded-full',
          ROLE_BADGE[u.role]
        )}>
        {ROLE_META[u.role as Role].label}
      </span>
    );
  }
  return (
    <select
      value={u.role}
      onChange={(e) => onRoleChange(u.email, e.target.value)}
      aria-label={`Role for ${u.name}`}
      className={cn(
        'text-[11px] font-semibold px-2.5 py-1 rounded-full border-none outline-none cursor-pointer appearance-none max-w-full',
        ROLE_BADGE[u.role]
      )}>
      {editableRoles.map((r) => (
        <option key={r} value={r}>
          {ROLE_META[r].label}
        </option>
      ))}
    </select>
  );
}

function UserStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit border capitalize shrink-0',
        status === 'active'
          ? 'bg-apsGreenLt text-apsGreen border-apsGreen/20'
          : 'bg-apsAmberLt text-amber-700 border-apsAmber/20'
      )}>
      {status}
    </span>
  );
}

export function UsersPage() {
  const { user } = useAuth();
  const { users, updateUserRole, inviteUser, updateUser, updateSupervisedAdrs } =
    useAppData();
  const adrUsers = users.filter((u) => u.role === 'adr' && u.id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    zone: '',
    status: 'active',
    supervisedAdrIds: [] as string[]
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'platform_staff' as Role,
    zone: '',
    supervisedAdrIds: [] as string[]
  });
  const [inviting, setInviting] = useState(false);

  const isPlatform =
    user?.role === 'system_owner' || user?.role === 'platform_staff';
  const canInvite =
    user &&
    (can(user.role, 'managePlatformUsers') ||
      can(user.role, 'manageCompanyUsers'));
  const canEditUsers =
    user &&
    (isPlatform
      ? can(user.role, 'managePlatformUsers')
      : can(user.role, 'editUsers'));
  const inviteRoles = isPlatform ? PLATFORM_INVITE_ROLES : COMPANY_INVITE_ROLES;
  const editableRoles = isPlatform ? PLATFORM_INVITE_ROLES : COMPANY_INVITE_ROLES;

  const openEdit = (u: CompanyUser) => {
    setEditTarget(u);
    setEditForm({
      name: u.name,
      zone: u.zone || '',
      status: u.status,
      supervisedAdrIds: u.supervised_adr_ids || []
    });
  };

  const toggleSupervisedAdr = (adrId: string, list: string[], setter: (v: string[]) => void) => {
    setter(
      list.includes(adrId) ? list.filter((id) => id !== adrId) : [...list, adrId]
    );
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await updateUser(editTarget.email, {
        name: editForm.name.trim(),
        ...(isPlatform ? {} : { zone: editForm.zone.trim() }),
        status: editForm.status
      });
      if (!isPlatform && editTarget.role === 'team_lead') {
        await updateSupervisedAdrs(editTarget.email, editForm.supervisedAdrIds);
      }
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
        zone: inviteForm.zone.trim() || undefined,
        ...(inviteForm.role === 'team_lead'
          ? { supervised_adr_ids: inviteForm.supervisedAdrIds }
          : {})
      });
      toast.success('User invited', {
        description: created.temporaryPassword
          ? `${created.email} — temp password: ${created.temporaryPassword}${
              created.credentialDelivery === 'log_only'
                ? ' (also logged in backend console & audit)'
                : ''
            }`
          : created.email,
        duration: 12000
      });
      setInviteOpen(false);
      setInviteForm({
        name: '',
        email: '',
        role: isPlatform ? 'platform_staff' : 'internal',
        zone: '',
        supervisedAdrIds: []
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
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
              className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-1.5 rounded-lg bg-navy text-white text-xs font-medium hover:bg-navyMid transition-colors shrink-0 w-full sm:w-auto">
              <UserPlus className="w-4 h-4" />
              Invite user
            </button>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <div
            className={cn(
              'grid gap-4 pb-3 mb-2 border-b border-slate-200',
              canEditUsers ? DESKTOP_GRID : DESKTOP_GRID_NO_EDIT
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
                key={u.id || u.email}
                className={cn(
                  'grid gap-4 py-3 border-b border-slate-100 last:border-0 items-center',
                  canEditUsers ? DESKTOP_GRID : DESKTOP_GRID_NO_EDIT
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
                    <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-600">{zoneLabel(u)}</div>
                <div>
                  <UserRoleControl
                    u={u}
                    roleLocked={roleLocked}
                    editableRoles={editableRoles}
                    onRoleChange={changeRole}
                  />
                </div>
                <UserStatusBadge status={u.status} />
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

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {users.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No users yet</p>
          ) : (
            users.map((u) => {
              const ac = avatarColor(u.name);
              const roleLocked = u.role === 'system_owner';
              return (
                <div
                  key={u.id || u.email}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                        ac.bg,
                        ac.text
                      )}>
                      {initials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {u.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{u.email}</div>
                    </div>
                    {canEditUsers && u.role !== 'manager' && (
                      <button
                        type="button"
                        title="Edit user"
                        onClick={() => openEdit(u)}
                        className="p-2 rounded-lg hover:bg-white text-slate-500 shrink-0">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Zone / scope
                      </div>
                      <div className="text-slate-700 leading-snug">{zoneLabel(u)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Status
                      </div>
                      <UserStatusBadge status={u.status} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Role
                    </div>
                    <UserRoleControl
                      u={u}
                      roleLocked={roleLocked}
                      editableRoles={editableRoles}
                      onRoleChange={changeRole}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
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
              {!isPlatform && inviteForm.role === 'team_lead' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">
                    Supervised ADRs
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {adrUsers.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          toggleSupervisedAdr(
                            a.id!,
                            inviteForm.supervisedAdrIds,
                            (ids) =>
                              setInviteForm((f) => ({ ...f, supervisedAdrIds: ids }))
                          )
                        }
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-medium border',
                          inviteForm.supervisedAdrIds.includes(a.id!)
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        )}>
                        {a.name}
                      </button>
                    ))}
                  </div>
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
              {!isPlatform && (
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
              )}
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
              {!isPlatform && editTarget.role === 'team_lead' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">
                    Supervised ADRs
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {adrUsers.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          toggleSupervisedAdr(
                            a.id!,
                            editForm.supervisedAdrIds,
                            (ids) =>
                              setEditForm((f) => ({ ...f, supervisedAdrIds: ids }))
                          )
                        }
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-medium border',
                          editForm.supervisedAdrIds.includes(a.id!)
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        )}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
