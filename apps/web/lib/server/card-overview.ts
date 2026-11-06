import type { Invoice } from "@packages/shared/cards";

/** Payment overview is separate from the purchase cycle and total committed debt. */
export function cardPaymentOverview(invoices: Invoice[], asOf: string) {
  const unpaid = invoices.filter(invoice => invoice.state !== "PAID").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = unpaid.find(invoice => invoice.dueDate >= asOf && invoice.totalMinor > 0);
  const overdue = unpaid.filter(invoice => invoice.dueDate < asOf && invoice.totalMinor > 0);
  return {
    nextInvoice: next ?? null,
    overdueMinor: overdue.reduce((sum, invoice) => sum + invoice.totalMinor, 0),
    overdueCount: overdue.length,
    overdueInvoice: overdue[0] ?? null,
    // Retained for API compatibility; all posted entries now belong to the payable total.
    nextForecast: null,
  };
}
