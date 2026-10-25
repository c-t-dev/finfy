-- Hand-written migration: things drizzle-kit does not generate.

-- Accepted currencies (wiki/decisoes/0001-multimoeda.md). Same list as CURRENCIES in src/money.ts.
INSERT INTO "currencies" ("code", "name", "symbol", "minor_units") VALUES
  ('EUR', 'Euro', '€', 2),
  ('BRL', 'Brazilian real', 'R$', 2)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint

-- audit_logs is append-only (wiki/decisoes/0006-auditoria.md).
CREATE FUNCTION "audit_logs_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();
--> statement-breakpoint

-- Tables PowerSync replicates. Keep in step with SYNCED_TABLES in src/db/schema/index.ts.
-- Never FOR ALL TABLES: credentials, sessions, tokens, e-mails and audit stay out.
CREATE PUBLICATION "powersync" FOR TABLE "wallets", "wallet_members";
