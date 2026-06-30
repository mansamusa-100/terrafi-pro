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
  History
} from
'lucide-react';

export type Role =
'system_owner' |
'platform_staff' |
'manager' |
'internal' |
'adr' |
'agent' |
'teller';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: string;
  scope: string;
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
{ id: 'agents', icon: Users, label: 'Agents', badge: 312 },
{ id: 'map', icon: MapPin, label: 'Network Map' },
{ id: 'visits', icon: Map, label: 'Visits' },
{ id: 'float', icon: Wallet, label: 'Float Monitor' },
{ id: 'float-sync', icon: History, label: 'Float sync log' },
{ id: 'performance', icon: TrendingUp, label: 'Performance' },
{ id: 'training', icon: GraduationCap, label: 'Training' },
{ id: 'compliance', icon: ShieldCheck, label: 'Compliance', badge: 5 },
{ id: 'users', icon: UserCog, label: 'Users & Roles' },
{ id: 'audit', icon: ScrollText, label: 'Audit log' },
{ id: 'settings', icon: Settings, label: 'Settings' }] as
const;

// Which pages each role can access, in nav order
export const PAGE_ACCESS: Record<Role, string[]> = {
  system_owner: ['companies', 'users', 'audit', 'settings'],
  platform_staff: ['companies', 'users', 'audit'],
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
  'audit',
  'settings'],

  internal: ['dashboard', 'float', 'performance', 'compliance'],
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
    configure: true
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
    onboardAgent: true,
    logVisit: true,
    scheduleVisit: true,
    editAgent: true,
    editUsers: true
  },
  internal: {},
  adr: { onboardAgent: true, logVisit: true },
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
  return PAGES.filter((p) => allowed.includes(p.id));
}