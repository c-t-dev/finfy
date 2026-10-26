"use client";

import * as React from "react";
import { CURRENCIES, formatMoney, parseMoney, type Currency, type CurrencyCode } from "@packages/shared/money";
import { useLocale } from "./i18n";

/** Decimal separator of the language: "," in pt-BR, "." in en. */
export function decimalSeparator(locale: string): "." | "," {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === "decimal")?.value === "," ? "," : ".";
}

/** Minor units as an editable number ("-123,45"), without floats or grouping. */
export function minorToInput(minor: number, currency: Currency, separator: "." | ","): string {
  const sign = minor < 0 ? "-" : "";
  const digits = String(Math.abs(minor)).padStart(currency.minorUnits + 1, "0");
  const whole = digits.slice(0, digits.length - currency.minorUnits);
  const fraction = digits.slice(digits.length - currency.minorUnits);
  return currency.minorUnits ? `${sign}${whole}${separator}${fraction}` : `${sign}${whole}`;
}

/** Formatting and parsing for one wallet currency in the user's language. */
export function useMoney(currencyCode: CurrencyCode) {
  const locale = useLocale();
  return React.useMemo(() => {
    const currency = CURRENCIES[currencyCode];
    const separator = decimalSeparator(locale);
    const compact = new Intl.NumberFormat(locale, { style: "currency", currency: currency.code, notation: "compact", maximumFractionDigits: 1 });
    return {
      currency,
      separator,
      format: (minor: number) => formatMoney(minor, currency, locale),
      /** Short label for chart axes ("R$ 1,2 mil"); display only, never parsed back. */
      compact: (minor: number) => compact.format(minor / 10 ** currency.minorUnits),
      /** null when the text is not a valid amount. */
      parse: (text: string) => parseMoney(text, currency, separator),
      toInput: (minor: number) => minorToInput(minor, currency, separator),
    };
  }, [currencyCode, locale]);
}

/** Today in the user's time zone, as an ISO date. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
