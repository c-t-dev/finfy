import type { Invoice } from "@packages/shared/cards";

/** Payment overview is separate from the purchase cycle and total committed debt. */
export function cardPaymentOverview(invoices: Invoice[], actual: Map<string, number>, asOf: string) {
  const unpaid = invoices.filter(invoice => invoice.state !== "PAID").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = unpaid.find(invoice => invoice.dueDate >= asOf && (actual.get(invoice.id) ?? 0) > 0);
  const overdue = unpaid.filter(invoice => invoice.dueDate < asOf && (actual.get(invoice.id) ?? 0) > 0);
  const forecast = unpaid.find(invoice => invoice.dueDate >= asOf && invoice.totalMinor > (actual.get(invoice.id) ?? 0));
  return {
    nextInvoice: next ? { ...next, totalMinor: actual.get(next.id)! } : null,
    overdueMinor: overdue.reduce((sum, invoice) => sum + (actual.get(invoice.id) ?? 0), 0),
    overdueCount: overdue.length,
    overdueInvoice: overdue[0] ? { ...overdue[0], totalMinor: actual.get(overdue[0].id)! } : null,
    nextForecast: forecast ? { dueDate: forecast.dueDate, amountMinor: forecast.totalMinor - (actual.get(forecast.id) ?? 0) } : null,
  };
}
