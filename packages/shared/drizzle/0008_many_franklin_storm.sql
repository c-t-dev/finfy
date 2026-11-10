CREATE TABLE "agent_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"wallet_ids" uuid[] NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_purchase_requests" (
	"connection_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"purchase_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	CONSTRAINT "agent_purchase_requests_connection_id_request_id_pk" PRIMARY KEY("connection_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" text DEFAULT 'FREE' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_purchase_requests" ADD CONSTRAINT "agent_purchase_requests_connection_id_agent_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_connections_token_hash_unique" ON "agent_connections" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "agent_connections_user_idx" ON "agent_connections" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plan_check" CHECK ("users"."plan" in ('FREE', 'PAID'));