/**
 * Credit card invoice math: which invoice a purchase belongs to, its dates,
 * installments and state. Pure and import-free, so the server, the screens
 * and the tests (run directly by Node) agree on it.
 */

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
/** Month `delta` steps from (year, month), as [year, month]. */
function shift(year: number, month: number, delta: number): [number, number] {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

export interface InvoicePeriod {
  referenceYear: number;
  referenceMonth: number;
  /** First day of the cycle (day after the previous closing). */
  openingDate: string;
  closingDate: string;
  dueDate: string;
}

/**
 * The invoice of a reference month: it closes on `closingDay` of that month
 * (or the month's last day when shorter) and is due on `dueDay`, in the same
 * month when the due day comes after the closing day, otherwise in the next.
 */
export function invoicePeriod(referenceYear: number, referenceMonth: number, closingDay: number, dueDay: number): InvoicePeriod {
  const closing = Math.min(closingDay, daysIn(referenceYear, referenceMonth));
  const [prevYear, prevMonth] = shift(referenceYear, referenceMonth, -1);
  const prevClosing = Math.min(closingDay, daysIn(prevYear, prevMonth));
  const opening = new Date(Date.UTC(prevYear, prevMonth - 1, prevClosing + 1));
  const [dueYear, dueMonth] = dueDay > closingDay ? [referenceYear, referenceMonth] : shift(referenceYear, referenceMonth, 1);
  return {
    referenceYear,
    referenceMonth,
    openingDate: opening.toISOString().slice(0, 10),
    closingDate: iso(referenceYear, referenceMonth, closing),
    dueDate: iso(dueYear, dueMonth, Math.min(dueDay, daysIn(dueYear, dueMonth))),
  };
}

/** The invoice a purchase made on `date` goes to: after the closing day, the next one. */
export function invoiceForDate(date: string, closingDay: number, dueDay: number): InvoicePeriod {
  const [year, month, day] = date.split("-").map(Number);
  const closing = Math.min(closingDay, daysIn(year, month));
  const [refYear, refMonth] = day <= closing ? [year, month] : shift(year, month, 1);
  return invoicePeriod(refYear, refMonth, closingDay, dueDay);
}

/** `date` plus `months`, keeping the day when it exists (Jan 31 + 1 month = Feb 28). */
export function addMonthsToDate(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const [y, m] = shift(year, month, months);
  return iso(y, m, Math.min(day, daysIn(y, m)));
}

/** Splits a total in `count` integer parts; the leftover minor units go to the first. */
export function splitInstallments(totalMinor: number, count: number): number[] {
  const base = Math.floor(totalMinor / count);
  const parts = Array.from({ length: count }, () => base);
  parts[0] += totalMinor - base * count;
  return parts;
}

export type InvoiceState = "OPEN" | "CLOSED" | "OVERDUE" | "PAID";

/** OPEN and PAID are stored; CLOSED and OVERDUE come from today's date. */
export function invoiceState(stored: "OPEN" | "PAID", closingDate: string, dueDate: string, today: string): InvoiceState {
  if (stored === "PAID") return "PAID";
  if (today > dueDate) return "OVERDUE";
  if (today > closingDate) return "CLOSED";
  return "OPEN";
}
