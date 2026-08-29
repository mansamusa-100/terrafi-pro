import { todayISO } from '../middleware/user.js';

function parseISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Inclusive day count between ISO date strings. */
export function daysInclusive(from, to) {
  const start = parseISO(from);
  const end = parseISO(to);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

/**
 * Resolve a reporting period from preset or custom from/to (ISO dates).
 * @returns {{ from: string, to: string, preset: string }}
 */
export function resolveDateRange(preset, from, to) {
  const today = parseISO(todayISO());
  const p = (preset || 'this_month').toLowerCase();

  if (p === 'custom' && from && to) {
    return { from, to, preset: 'custom' };
  }

  if (p === '7days') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: formatISO(start), to: formatISO(today), preset: p };
  }

  if (p === 'this_week') {
    return {
      from: formatISO(startOfWeek(today)),
      to: formatISO(today),
      preset: p
    };
  }

  if (p === 'last_week') {
    const lastWeekEnd = new Date(startOfWeek(today));
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekStart = startOfWeek(lastWeekEnd);
    return {
      from: formatISO(lastWeekStart),
      to: formatISO(lastWeekEnd),
      preset: p
    };
  }

  if (p === 'last_month') {
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      from: formatISO(startOfMonth(prev)),
      to: formatISO(endOfMonth(prev)),
      preset: p
    };
  }

  if (p === 'all') {
    return { from: '2000-01-01', to: formatISO(today), preset: 'all' };
  }

  // this_month (default)
  return {
    from: formatISO(startOfMonth(today)),
    to: formatISO(today),
    preset: p === 'this_month' ? p : 'this_month'
  };
}

export function todayBoundsUTC() {
  const today = todayISO();
  return {
    from: new Date(`${today}T00:00:00.000Z`),
    to: new Date(`${today}T23:59:59.999Z`)
  };
}

export function isoRangeToDates(from, to) {
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`)
  };
}
