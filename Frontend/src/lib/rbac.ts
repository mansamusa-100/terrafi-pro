import React from 'react';
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
  ClipboardList,
  type LucideIcon
} from 'lucide-react';

export type Role =
  | 'system_owner'
  | 'platform_staff'
  | 'manager'
  | 'internal'
  | 'team_lead'
  | 'adr'
  | 'agent'
  | 'teller';

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
  { label: string; short: string; description: string; level: string }
> = {
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

/** Leaf pages (metadata for titles and lookups). */
export const PAGES = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
  { id: 'companies', icon: Building2, label: 'Companies' },
  { id: 'agents', icon: Users, label: 'Agents' },
  { id: 'map', icon: MapPin, label: 'Network Map' },
  { id: 'visits', icon: Map, label: 'Visits' },
  { id: 'float', icon: Wallet, label: 'Float Monitoring' },
  { id: 'float-sync', icon: History, label: 'Float sync log' },
  { id: 'performance', icon: TrendingUp, label: 'Overview' },
  { id: 'performance-agent-report', icon: ClipboardList, label: 'Agent report' },
  { id: 'performance-officer-report', icon: ClipboardList, label: 'Officer report' },
  { id: 'training', icon: GraduationCap, label: 'Training' },
  { id: 'compliance', icon: ShieldCheck, label: 'Compliance' },
  { id: 'users', icon: UserCog, label: 'Users & Roles' },
  { id: 'notification-report', icon: ClipboardList, label: 'Notification report' },
  { id: 'audit', icon: ScrollText, label: 'Audit log' },
  { id: 'settings', icon: Settings, label: 'Settings' }
] as const;

export type NavChild = { id: string; label: string };

export type NavEntry =
  | { kind: 'page'; id: string; icon: LucideIcon; label: string }
  | {
      kind: 'group';
      id: string;
      icon: LucideIcon;
      label: string;
      children: NavChild[];
    };

const NAV_GROUPS = [
  {
    id: 'performance-group',
    icon: TrendingUp,
    label: 'Performance',
    pageIds: ['performance', 'performance-agent-report', 'performance-officer-report'] as const,
    childLabels: {
      performance: 'Overview',
      'performance-agent-report': 'Agent report',
      'performance-officer-report': 'Officer report'
    } as Record<string, string>
  },
  {
    id: 'float-management',
    icon: Wallet,
    label: 'Float Management',
    pageIds: ['float', 'float-sync'] as const,
    childLabels: {
      float: 'Float Monitoring',
      'float-sync': 'Float sync log'
    } as Record<string, string>
  }
];

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
    'performance-agent-report',
    'performance-officer-report',
    'training',
    'compliance',
    'users',
    'notification-report',
    'audit',
    'settings'
  ],
  internal: [
    'dashboard',
    'float',
    'performance',
    'performance-agent-report',
    'performance-officer-report',
    'compliance'
  ],
  team_lead: [
    'dashboard',
    'agents',
    'map',
    'visits',
    'performance',
    'performance-agent-report',
    'performance-officer-report'
  ],
  adr: ['dashboard', 'agents', 'map', 'visits', 'performance-agent-report', 'performance-officer-report'],
  agent: ['dashboard', 'float', 'visits', 'training'],
  teller: ['dashboard', 'float']
};

export const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Overview',
  companies: 'Companies',
  agents: 'Agent Directory',
  map: 'Network Map',
  visits: 'Field Visits',
  float: 'Float Monitoring',
  'float-sync': 'Float sync log',
  performance: 'Performance · Overview',
  'performance-agent-report': 'Performance · Agent report',
  'performance-officer-report': 'Performance · Officer report',
  training: 'Training',
  compliance: 'Compliance',
  users: 'Users & Roles',
  'notification-report': 'Notification report',
  audit: 'Audit log',
  settings: 'Settings'
};

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

export function pageTitleFor(page: string, role?: Role): string {
  if (page === 'dashboard') {
    if (role === 'system_owner' || role === 'platform_staff') return 'Platform Overview';
    if (role === 'team_lead') return 'Regional hub';
    return 'Network Overview';
  }
  return PAGE_TITLES[page] || 'Dashboard';
}

/** Returns sidebar nav with Performance and Float Management as dropdown groups. */
export function navFor(role: Role): NavEntry[] {
  const allowed = PAGE_ACCESS[role] || [];
  const allowedSet = new Set(allowed);
  const consumed = new Set<string>();
  const entries: NavEntry[] = [];

  for (const pageId of allowed) {
    if (consumed.has(pageId)) continue;

    const groupDef = NAV_GROUPS.find((g) =>
      (g.pageIds as readonly string[]).includes(pageId)
    );

    if (groupDef) {
      const children = groupDef.pageIds
        .filter((id) => allowedSet.has(id))
        .map((id) => ({ id, label: groupDef.childLabels[id] }));

      if (children.length > 0) {
        entries.push({
          kind: 'group',
          id: groupDef.id,
          icon: groupDef.icon,
          label: groupDef.label,
          children
        });
        for (const id of groupDef.pageIds) {
          if (allowedSet.has(id)) consumed.add(id);
        }
      }
      continue;
    }

    const page = PAGES.find((p) => p.id === pageId);
    if (page) {
      const label =
        role === 'team_lead' && page.id === 'dashboard'
          ? 'Regional hub'
          : page.label;
      entries.push({
        kind: 'page',
        id: page.id,
        icon: page.icon,
        label
      });
      consumed.add(pageId);
    }
  }

  return entries;
}

/** Group id if `page` is a child of a nav dropdown. */
export function navGroupForPage(page: string): string | null {
  for (const g of NAV_GROUPS) {
    if ((g.pageIds as readonly string[]).includes(page)) return g.id;
  }
  return null;
}
