export const fmt = (n: number) =>
  n >= 1000000
    ? `D ${(n / 1000000).toFixed(1)}M`
    : n >= 1000
      ? `D ${(n / 1000).toFixed(0)}K`
      : `D ${n}`;

export const pct = (a: number, b: number) => Math.round((a / b) * 100);

export const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);

export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  active: {
    label: 'Active',
    color: 'text-apsGreen',
    bg: 'bg-apsGreenLt',
    border: 'border-apsGreen/20'
  },
  low_float: {
    label: 'Low float',
    color: 'text-apsAmber',
    bg: 'bg-apsAmberLt',
    border: 'border-apsAmber/20'
  },
  critical: {
    label: 'Critical',
    color: 'text-apsRed',
    bg: 'bg-apsRedLt',
    border: 'border-apsRed/20'
  },
  suspended: {
    label: 'Suspended',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200'
  }
};

export const AVATAR_COLORS = [
  { bg: 'bg-apsBlueLt', text: 'text-apsBlue' },
  { bg: 'bg-apsTealLt', text: 'text-apsTeal' },
  { bg: 'bg-apsAmberLt', text: 'text-amber-800' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-apsGreenLt', text: 'text-green-800' }
];

export function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}
