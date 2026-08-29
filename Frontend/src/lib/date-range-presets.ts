export type DateRangePreset =
  | '7days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'all'
  | 'custom';

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: '7days', label: 'Last 7 days' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'all', label: 'All agents' },
  { value: 'custom', label: 'Custom range' }
];

export function presetLabel(preset: string) {
  return DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

export function formatReportDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatReportDateTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}
