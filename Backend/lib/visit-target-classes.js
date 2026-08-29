export const DEFAULT_VISIT_TARGET_CLASSES = {
  exceeded_min: 100,
  met_min: 80,
  below_min: 50
};

export const TARGET_CLASS_LABELS = {
  exceeded: 'Exceeded',
  met: 'Met',
  below: 'Below',
  critical: 'Critical'
};

export function parseVisitTargetClasses(raw) {
  const base = { ...DEFAULT_VISIT_TARGET_CLASSES };
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw;
  for (const key of ['exceeded_min', 'met_min', 'below_min']) {
    const n = Number.parseInt(String(obj[key]), 10);
    if (Number.isFinite(n) && n >= 0 && n <= 200) {
      base[key] = n;
    }
  }
  if (base.exceeded_min < base.met_min) base.exceeded_min = base.met_min;
  if (base.met_min < base.below_min) base.met_min = base.below_min;
  return base;
}

/** Visit achievement rate % → class key. */
export function resolveTargetClass(ratePct, thresholds) {
  const t = parseVisitTargetClasses(thresholds);
  if (ratePct >= t.exceeded_min) return 'exceeded';
  if (ratePct >= t.met_min) return 'met';
  if (ratePct >= t.below_min) return 'below';
  return 'critical';
}

export function serializeVisitTargetClasses(raw) {
  return parseVisitTargetClasses(raw);
}
