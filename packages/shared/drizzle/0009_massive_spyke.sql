CREATE TABLE "agent_entry_requests" (
	"connection_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"receipt" jsonb NOT NULL,
	CONSTRAINT "agent_entry_requests_connection_id_request_id_pk" PRIMARY KEY("connection_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "agent_entry_requests" ADD CONSTRAINT "agent_entry_requests_connection_id_agent_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE no action ON UPDATE no action;