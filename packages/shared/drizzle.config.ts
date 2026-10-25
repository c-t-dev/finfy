import { defineConfig } from "drizzle-kit";

// Migrations are generated from the schema and committed (packages/shared/drizzle).
// Follow "expand, then contract" for synced tables (wiki/finfy/data-model.md).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://finfy:finfy@localhost:5432/finfy",
  },
  strict: true,
});
