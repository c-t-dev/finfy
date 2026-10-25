/**
 * Money is an integer in minor units plus the wallet's currency, never a float
 * (wiki/decisoes/0001-multimoeda.md). The number of decimals comes from the
 * currency (`currencies.minor_units`), not a fixed ×100.
 */
export interface Currency {
  code: string;
  minorUnits: number;
}

export const CURRENCIES = {
  EUR: { code: "EUR", minorUnits: 2 },
  BRL: { code: "BRL", minorUnits: 2 },
} as const satisfies Record<string, Currency>;

export type CurrencyCode = keyof typeof CURRENCIES;

/**
 * Formats by the user's language, not by the currency: in `en` a BRL wallet
 * shows `R$1,234.56`, in `pt-BR` it shows `R$ 1.234,56`.
 */
export function formatMoney(amountMinor: number, currency: Currency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.minorUnits,
    maximumFractionDigits: currency.minorUnits,
  }).format(amountMinor / 10 ** currency.minorUnits);
}

/**
 * Parses a decimal typed by the user ("1234.5", "1.234,56", "-12") into minor
 * units without going through a float. `decimalSeparator` comes from the
 * user's language. Returns null for invalid input or too many decimals.
 */
export function parseMoney(input: string, currency: Currency, decimalSeparator: "." | ","): number | null {
  const groupSeparator = decimalSeparator === "," ? "." : ",";
  const cleaned = input.trim().replaceAll(" ", "").replaceAll(groupSeparator, "");
  const match = new RegExp(`^(-)?(\\d+)(?:\\${decimalSeparator}(\\d*))?$`).exec(cleaned);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > currency.minorUnits) return null;
  const minor = Number(whole + fraction.padEnd(currency.minorUnits, "0"));
  if (!Number.isSafeInteger(minor)) return null;
  return sign ? -minor : minor;
}
