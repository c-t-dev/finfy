// Fails when the message files do not have exactly the same keys
// (wiki/decisoes/0011-traducoes.md, rule 3). Run with `pnpm check:messages`.
import { readFileSync } from "node:fs";
import { LOCALES, DEFAULT_LOCALE } from "../src/i18n/locales.ts";

type Messages = { [key: string]: string | Messages };

function keys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [prefix + key] : keys(value, `${prefix}${key}.`),
  );
}

function load(locale: string): Messages {
  return JSON.parse(readFileSync(new URL(`../src/i18n/messages/${locale}.json`, import.meta.url), "utf8"));
}

const reference = new Set(keys(load(DEFAULT_LOCALE)));
let failed = false;

for (const locale of LOCALES) {
  if (locale === DEFAULT_LOCALE) continue;
  const current = new Set(keys(load(locale)));
  const missing = [...reference].filter((key) => !current.has(key));
  const extra = [...current].filter((key) => !reference.has(key));
  for (const key of missing) console.error(`${locale}: missing "${key}"`);
  for (const key of extra) console.error(`${locale}: extra "${key}" (not in ${DEFAULT_LOCALE})`);
  if (missing.length || extra.length) failed = true;
}

if (failed) process.exit(1);
console.log(`Messages OK: ${LOCALES.join(", ")} have ${reference.size} keys each.`);
