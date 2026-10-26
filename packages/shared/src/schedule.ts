/**
 * Dates of a recurrence. Pure and import-free, so the server, the screens and
 * the tests (run directly by Node) agree on them.
 */

export type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "YEARLY";

const MONTH_STEPS: Partial<Record<Frequency, number>> = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, YEARLY: 12 };
const DAY_STEPS: Partial<Record<Frequency, number>> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14 };

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The n-th date (0 = start). Month-based frequencies keep the start's day,
 * clamped to shorter months (Jan 31 monthly → Feb 28, Mar 31), so a short
 * month never shifts the following dates.
 */
export function nthDate(start: string, frequency: Frequency, n: number): string {
  const [year, month, day] = start.split("-").map(Number);
  const days = DAY_STEPS[frequency];
  if (days) return iso(new Date(Date.UTC(year, month - 1, day + days * n)));
  const index = year * 12 + (month - 1) + (MONTH_STEPS[frequency] ?? 1) * n;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return iso(new Date(Date.UTC(y, m - 1, Math.min(day, daysIn(y, m)))));
}

/** Dates from `start` up to `until` (inclusive) and `end` (when set), at most `limit`. */
export function occurrenceDates(start: string, frequency: Frequency, until: string, end: string | null, limit = 400): string[] {
  const last = end && end < until ? end : until;
  const dates: string[] = [];
  for (let n = 0; n < limit; n++) {
    const date = nthDate(start, frequency, n);
    if (date > last) break;
    dates.push(date);
  }
  return dates;
}

/** `date` plus `days`, as an ISO date. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return iso(new Date(Date.UTC(year, month - 1, day + days)));
}
