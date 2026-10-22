CREATE TABLE "integration_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"city" text NOT NULL,
	"table_count" integer,
	"notes" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_request_status" CHECK ("integration_requests"."status" in ('NEW','CONTACTED')),
	CONSTRAINT "integration_request_tables" CHECK ("integration_requests"."table_count">0)
);
--> statement-breakpoint
CREATE INDEX "integration_requests_created_idx" ON "integration_requests" USING btree ("created_at");