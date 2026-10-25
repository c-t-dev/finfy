import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@packages/env/server";
import * as schema from "@packages/shared/db/schema";

let db: ReturnType<typeof createDb> | undefined;

function createDb(url: string) {
  // Small pool: each Vercel function instance opens its own connections.
  return drizzle(postgres(url, { max: 5 }), { schema });
}

/** Lazily connects, so pages that never touch the database build without DATABASE_URL. */
export function getDb() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  db ??= createDb(env.DATABASE_URL);
  return db;
}
