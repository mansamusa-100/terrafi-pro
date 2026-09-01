/** Manager-assignable capability keys for internal and team_lead users. */
export const ASSIGNED_CAPABILITY_IDS = [
  'review_kyc',
  'export_data',
  'view_float_sync',
  'view_agents',
  'edit_agents',
  'view_visits',
  'view_audit',
  'view_notification_report'
];

/** @deprecated Use ASSIGNED_CAPABILITY_IDS */
export const INTERNAL_CAPABILITY_IDS = ASSIGNED_CAPABILITY_IDS;

export const ASSIGNED_CAPABILITY_CATALOG = {
  review_kyc: {
    label: 'KYC review',
    description: 'Approve or reject agent KYC submissions in Compliance',
    assignableRoles: ['internal']
  },
  export_data: {
    label: 'Export data',
    description: 'Download CSV exports from reports and compliance',
    assignableRoles: ['internal']
  },
  view_float_sync: {
    label: 'Float sync log',
    description: 'View float reconciliation sync history',
    assignableRoles: ['internal']
  },
  view_agents: {
    label: 'Agent directory',
    description: 'View agent profiles (read-only)',
    assignableRoles: ['internal']
  },
  edit_agents: {
    label: 'Edit agents',
    description: 'Edit agent profiles — name, phone, zone and status',
    assignableRoles: ['internal', 'team_lead']
  },
  view_visits: {
    label: 'Field visits',
    description: 'View visit logs and summaries',
    assignableRoles: ['internal']
  },
  view_audit: {
    label: 'Audit log',
    description: 'View company audit trail',
    assignableRoles: ['internal']
  },
  view_notification_report: {
    label: 'Notification report',
    description: 'View credential delivery and notification logs',
    assignableRoles: ['internal']
  }
};

/** @deprecated Use ASSIGNED_CAPABILITY_CATALOG */
export const INTERNAL_CAPABILITY_CATALOG = ASSIGNED_CAPABILITY_CATALOG;

const ASSIGNED_CAP_GRANTS = {
  review_kyc: ['reviewKyc'],
  export_data: ['exportData'],
  view_float_sync: ['viewFloatSync'],
  view_audit: ['viewCompanyAudit'],
  edit_agents: ['editAgent']
};

const ASSIGNED_CAP_PAGES = {
  view_float_sync: ['float-sync'],
  view_agents: ['agents'],
  edit_agents: ['agents'],
  view_visits: ['visits'],
  view_audit: ['audit'],
  view_notification_report: ['notification-report']
};

export const INTERNAL_BASE_PAGES = [
  'dashboard',
  'float',
  'performance',
  'performance-agent-report',
  'performance-officer-report',
  'compliance'
];

export const ASSIGNABLE_ROLES = ['internal', 'team_lead'];

export function capabilityIdsForRole(role) {
  if (!ASSIGNABLE_ROLES.includes(role)) return [];
  return ASSIGNED_CAPABILITY_IDS.filter((id) =>
    ASSIGNED_CAPABILITY_CATALOG[id].assignableRoles.includes(role)
  );
}

export function parseAssignedCapabilities(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id) => ASSIGNED_CAPABILITY_IDS.includes(id)))];
}

/** @deprecated Use parseAssignedCapabilities */
export function parseInternalCapabilities(raw) {
  return parseAssignedCapabilities(raw);
}

export function normalizeAssignedCapabilitiesInput(body, role) {
  if (!Array.isArray(body)) {
    throw Object.assign(new Error('capabilities must be an array'), { status: 400 });
  }
  const allowed = capabilityIdsForRole(role);
  const invalid = body.filter((id) => !allowed.includes(id));
  if (invalid.length) {
    throw Object.assign(new Error(`Capabilities not allowed for this role: ${invalid.join(', ')}`), {
      status: 400
    });
  }
  return parseAssignedCapabilities(body);
}

/** @deprecated Use normalizeAssignedCapabilitiesInput */
export function normalizeInternalCapabilitiesInput(body) {
  return normalizeAssignedCapabilitiesInput(body, 'internal');
}

export function assignedPagesFor(role, capabilityIds) {
  if (role === 'internal') {
    const pages = new Set(INTERNAL_BASE_PAGES);
    for (const id of capabilityIds) {
      for (const page of ASSIGNED_CAP_PAGES[id] || []) {
        pages.add(page);
      }
    }
    return [...pages];
  }
  return null;
}

export function internalPagesFor(capabilityIds) {
  return assignedPagesFor('internal', capabilityIds);
}

export function hasAssignedCapability(user, capabilityId) {
  if (!user || !ASSIGNABLE_ROLES.includes(user.role)) return false;
  const assigned = parseAssignedCapabilities(user.internalCapabilities);
  return assigned.includes(capabilityId);
}

/** @deprecated Use hasAssignedCapability */
export function hasInternalCapability(user, capabilityId) {
  return hasAssignedCapability(user, capabilityId);
}

export function userCanEditAgentProfile(user) {
  return user?.role === 'manager' || hasAssignedCapability(user, 'edit_agents');
}

export function userHasAppCapability(user, capability) {
  if (!user?.role) return false;
  if (!ASSIGNABLE_ROLES.includes(user.role)) return null;
  if (user.role === 'internal' && capability === 'viewKycCompliance') return true;
  const assigned = parseAssignedCapabilities(user.internalCapabilities);
  for (const id of assigned) {
    if ((ASSIGNED_CAP_GRANTS[id] || []).includes(capability)) return true;
  }
  return false;
}

export function userCanAccessPage(user, page) {
  if (!user?.role) return false;
  if (user.role !== 'internal') return null;
  const pages = internalPagesFor(parseAssignedCapabilities(user.internalCapabilities));
  return pages.includes(page);
}

/** Manager always allowed; assignable roles need the given capability key. */
export function managerOrAssignedCapability(...capabilityIds) {
  return (req, res, next) => {
    if (req.user?.role === 'manager') return next();
    if (
      ASSIGNABLE_ROLES.includes(req.user?.role) &&
      capabilityIds.some((id) => hasAssignedCapability(req.user, id))
    ) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

/** @deprecated Use managerOrAssignedCapability */
export function managerOrInternalCapability(...capabilityIds) {
  return managerOrAssignedCapability(...capabilityIds);
}

/** Allow listed roles, or assignable roles with any of the given capabilities. */
export function requireRolesOrAssignedCapability(roles, ...capabilityIds) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) return next();
    if (
      ASSIGNABLE_ROLES.includes(req.user?.role) &&
      capabilityIds.some((id) => hasAssignedCapability(req.user, id))
    ) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

/** @deprecated Use requireRolesOrAssignedCapability */
export function requireRolesOrInternalCapability(roles, ...capabilityIds) {
  return requireRolesOrAssignedCapability(roles, ...capabilityIds);
}

/** Block internal users without a capability from an endpoint. Other roles pass through. */
export function denyInternalWithout(...capabilityIds) {
  return (req, res, next) => {
    if (req.user?.role !== 'internal') return next();
    if (capabilityIds.some((id) => hasAssignedCapability(req.user, id))) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
