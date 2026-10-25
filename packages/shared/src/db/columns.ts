import { sql, type SQL } from "drizzle-orm";
import { bigint, check, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { newId } from "../ids";

/**
 * Column helpers shared by every table. The rules behind them are in
 * wiki/finfy/data-model.md ("Conventions" and "Sync-ready schema rules").
 */

/** Single-column `id` primary key (UUIDv7). Clients normally send their own. */
export const idColumn = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => newId());

/** `timestamptz` in UTC; PowerSync maps it to ISO 8601 text on the device. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const createdAt = () => timestamptz("created_at").notNull().defaultNow();
export const updatedAt = () => timestamptz("updated_at").notNull().defaultNow();

/** Money and counters: `bigint` read as a JS number (safe up to 2^53). */
export const bigintNumber = (name: string) => bigint(name, { mode: "number" });

/**
 * Enums are `text` + `CHECK`, never native Postgres enums, so values can be
 * added without locking migrations. Pair with `enumCheck` in the table extras.
 */
export const textEnum = <const T extends readonly [string, ...string[]]>(name: string, values: T) =>
  text(name, { enum: values as unknown as [T[number], ...T[number][]] });

export function enumCheck(name: string, column: AnyPgColumn, values: readonly string[]) {
  const list: SQL = sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", "));
  return check(name, sql`${column} in (${list})`);
}

/**
 * Columns every synced table carries besides its own (data-model.md, "Common
 * columns of synced tables"). `version` and the `updated_*` pair are set by the
 * server, never by the device clock. `walletId` is added per table because the
 * FK target lives in wallets.ts.
 */
export const syncedColumns = () => ({
  id: idColumn(),
  version: bigintNumber("version").notNull().default(1),
  createdAt: createdAt(),
  createdBy: uuid("created_by"),
  updatedAt: updatedAt(),
  updatedBy: uuid("updated_by"),
  archivedAt: timestamptz("archived_at"),
  archivedBy: uuid("archived_by"),
});
