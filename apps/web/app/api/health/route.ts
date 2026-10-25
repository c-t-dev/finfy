import { sql } from "drizzle-orm";
import { env } from "@packages/env/server";
import { getDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Liveness plus database reachability. Never exposes connection details. */
export async function GET() {
  if (!env.DATABASE_URL) return Response.json({ status: "ok", database: "not_configured" });
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", database: "ok" });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
