import {
  LayoutDashboard,
  Users,
  MapPin,
  Map,
  Wallet,
  TrendingUp,
  GraduationCap,
  ShieldCheck,
  Settings,
  Building2,
  UserCog,
  ScrollText,
  History,
  ClipboardList
} from
'lucide-react';

export type Role =
'system_owner' |
'platform_staff' |
'manager' |
'internal' |
'team_lead' |
'adr' |
'agent' |
'teller';

export interface AppBranding {
  title: string;
  subtitle: string;
  logo_url: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: string;
  company_id?: string | null;
  scope: string;
  zone?: string | null;
  status?: string;
  must_change_password?: boolean;
  supervised_adr_ids?: string[];
  branding: AppBranding;
}

export const ROLE_META: Record<
  Role,
  {label: string;short: string;description: string;level: string;}> =
{
  system_owner: {
    label: 'System Owner',
    short: 'Owner',
    description: 'Platform super-admin — platform users & subscriber oversight',
    level: 'Platform'
  },
  platform_staff: {
    label: 'Platform Staff',
    short: 'Staff',
    description: 'Platform team — support & platform user management',
    level: 'Platform'
  },
  manager: {
    label: 'Network Manager',
    short: 'Manager',
    description: 'Full access to their company network and users',
    level: 'Company'
  },
  internal: {
    label: 'Internal User',
    short: 'Internal',
    description: 'Back-office staff — compliance, float & performance',
    level: 'Company'
  },
  team_lead: {
    label: 'Team Lead (Regional)',
    short: 'Team Lead',
    description: 'Supervises assigned ADRs — field ops, onboarding & visits',
    level: 'Field'
  },
  adr: {
    label: 'ADR / Field Officer',
    short: 'ADR',
    description: 'Field-facing — visits, onboarding for assigned agents',
    level: 'Field'
  },
  agent: {
    label: 'Agent',
    short: 'Agent',
    description: 'Sees own profile, float, visits and training',
    level: 'Agent'
  },
  teller: {
    label: 'Agent Teller',
    short: 'Teller',
    description: 'Day-to-day float & transactions under an agent',
    level: 'Agent'
  }
};

// All navigable pages with their metadata
export const PAGES = [
{ id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
{ id: 'companies', icon: Building2, label: 'Companies' },
{ id: 'agents', icon: Users, label: 'Agents' },
{ id: 'map', icon: MapPin, label: 'Network Map' },
{ id: 'visits', icon: Map, label: 'Visits' },
{ id: 'float', icon: Wallet, label: 'Float Monitor' },
{ id: 'float-sync', icon: History, label: 'Float sync log' },
{ id: 'performance', icon: TrendingUp, label: 'Performance' },
{ id: 'training', icon: GraduationCap, label: 'Training' },
{ id: 'compliance', icon: ShieldCheck, label: 'Compliance' },
{ id: 'users', icon: UserCog, label: 'Users & Roles' },
{ id: 'notification-report', icon: ClipboardList, label: 'Notification report' },
{ id: 'audit', icon: ScrollText, label: 'Audit log' },
{ id: 'settings', icon: Settings, label: 'Settings' }] as
const;

// Which pages each role can access, in nav order
export const PAGE_ACCESS: Record<Role, string[]> = {
  system_owner: ['dashboard', 'companies', 'users', 'notification-report', 'audit'],
  platform_staff: ['dashboard', 'companies', 'users', 'notification-report', 'audit'],
  manager: [
  'dashboard',
  'agents',
  'map',
  'visits',
  'float',
  'float-sync',
  'performance',
  'training',
  'compliance',
  'users',
  'notification-report',
  'audit',
  'settings'],

  internal: ['dashboard', 'float', 'performance', 'compliance'],
  team_lead: ['dashboard', 'agents', 'map', 'visits', 'performance'],
  adr: ['dashboard', 'agents', 'map', 'visits'],
  agent: ['dashboard', 'float', 'visits', 'training'],
  teller: ['dashboard', 'float']
};

// Capability flags used to gate actions within pages
export const CAPABILITIES: Record<Role, Record<string, boolean>> = {
  system_owner: {
    managePlatformUsers: true,
    viewCompanies: true,
    viewPlatformAudit: true,
    manageCompanyStatus: true
  },
  platform_staff: {
    managePlatformUsers: true,
    viewCompanies: true,
    viewPlatformAudit: true
  },
  manager: {
    manageCompanyUsers: true,
    viewCompanyAudit: true,
    viewFloatSync: true,
    configure: true,
    manageBilling: true,
    onboardAgent: true,
    logVisit: true,
    scheduleVisit: true,
    editAgent: true,
    editAgentOnboarding: true,
    editUsers: true,
    reviewKyc: true,
    exportData: true
  },
  internal: {
    viewKycCompliance: true,
    exportData: true
  },
  team_lead: {
    onboardAgent: true,
    logVisit: true,
    scheduleVisit: true,
    assignAdr: true,
    editAgentOnboarding: true,
    exportData: true
  },
  adr: { onboardAgent: true, logVisit: true, scheduleVisit: true },
  agent: {},
  teller: {}
};

export function can(role: Role, capability: string): boolean {
  return !!CAPABILITIES[role]?.[capability];
}

export function canAccess(role: Role, page: string): boolean {
  return PAGE_ACCESS[role]?.includes(page) ?? false;
}

export function firstPageFor(role: Role): string {
  return PAGE_ACCESS[role]?.[0] ?? 'dashboard';
}

export function navFor(role: Role) {
  const allowed = PAGE_ACCESS[role] || [];
  return PAGES.filter((p) => allowed.includes(p.id)).map((p) =>
    role === 'team_lead' && p.id === 'dashboard'
      ? { ...p, label: 'Regional hub' }
      : p
  );
}