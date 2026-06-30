/**
 * Backend stores datetimes as naive UTC (no `Z` suffix). JS `new Date()` would
 * misinterpret those as local time. This mirrors the web app's parsing: append
 * `Z` unless the string already carries timezone info, so the value is treated
 * as UTC and rendered in the device's local timezone.
 */
export function parseBackendDate(value?: string | null): Date | null {
  if (!value) return null;
  const normalized =
    value.endsWith('Z') || value.includes('+') ? value : value + 'Z';
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(value?: string | null): string {
  const d = parseBackendDate(value);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

export function formatDateTime(value?: string | null): string {
  const d = parseBackendDate(value);
  return d ? d.toLocaleString() : '—';
}

export function formatDate(value?: string | null): string {
  const d = parseBackendDate(value);
  return d ? d.toLocaleDateString() : '—';
}
