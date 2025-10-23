-- Field index job tracking
CREATE TYPE "index_status" AS ENUM ('pending', 'in_progress', 'ready', 'failed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_indexes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "entity_type_id" uuid NOT NULL,
  "field_id" uuid NOT NULL,
  "index_name" text NOT NULL,
  "status" "index_status" DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "field_indexes_field_id_unique" UNIQUE ("field_id"),
  CONSTRAINT "field_indexes_index_name_unique" UNIQUE ("index_name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_indexes" ADD CONSTRAINT "field_indexes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_indexes" ADD CONSTRAINT "field_indexes_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_indexes" ADD CONSTRAINT "field_indexes_field_id_field_defs_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_defs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_indexes_status" ON "field_indexes" ("status");
--> statement-breakpoint
-- Row level security
ALTER TABLE "field_indexes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_only_field_indexes ON "field_indexes"
  FOR ALL
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid);
