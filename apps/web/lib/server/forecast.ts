import { invoiceForDate } from "@packages/shared/cards";
import { occurrenceDates, type Frequency } from "@packages/shared/recurrences";

/**
 * Recurrence occurrences past the stored horizon, simulated for the Home
 * charts (wiki/decisoes/0019). Nothing is written: up to the horizon the
 * occurrences already exist as pending entries (or were deleted on purpose),
 * so only dates after it are simulated and nothing counts twice. Pure, so the
 * tests run it without a database.
 */

export interface ForecastRecurrence {
  type: "INCOME" | "EXPENSE";
  amountMinor: number;
  frequency: string;
  startDate: string;
  endDate: string | null;
  accountId: string | null;
  creditCardId: string | null;
}

export interface ForecastCard {
  id: string;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
}

export interface ForecastEntry {
  type: "INCOME" | "EXPENSE";
  amountMinor: number;
  /** When it counts as income or expense: its date, or the card invoice's due date. */
  date: string;
  /** Whether it moves the projected balance: only through active accounts, like the Statement. */
  affectsBalance: boolean;
}

/** Enough steps for a daily recurrence started years ago to reach a year ahead. */
const STEP_LIMIT = 20_000;

export function forecastEntries(
  rows: ForecastRecurrence[],
  cards: ForecastCard[],
  activeAccountIds: ReadonlySet<string>,
  after: string,
  until: string,
): ForecastEntry[] {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const entries: ForecastEntry[] = [];
  for (const row of rows) {
    const card = row.creditCardId ? cardById.get(row.creditCardId) : undefined;
    // An archived card or account is not in the lists: its recurrence creates nothing.
    if (row.creditCardId ? !card : !row.accountId || !activeAccountIds.has(row.accountId)) continue;
    for (const date of occurrenceDates(row.startDate, row.frequency as Frequency, until, row.endDate, STEP_LIMIT)) {
      if (date <= after) continue;
      if (card) {
        // Card purchases count on their invoice's due date, which can fall after `until`.
        const due = invoiceForDate(date, card.closingDay, card.dueDay).dueDate;
        if (due > until) continue;
        entries.push({ type: "EXPENSE", amountMinor: row.amountMinor, date: due, affectsBalance: activeAccountIds.has(card.paymentAccountId) });
      } else {
        entries.push({ type: row.type, amountMinor: row.amountMinor, date, affectsBalance: true });
      }
    }
  }
  return entries;
}
