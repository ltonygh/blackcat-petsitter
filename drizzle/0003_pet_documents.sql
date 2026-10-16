-- ============================================================================
-- Migration 0003_pet_documents
-- Object storage support: pet documents + pet icon_key.
--
-- Adds:
--   1. pets.icon_key (nullable TEXT) — stock icon ref or uploaded R2 key.
--   2. Backfill of icon_key for existing pets based on type.
--   3. pet_documents table (name used as-is; icons are a document type).
--   4. Partial indexes on pet_documents (live rows only).
--   5. A partial UNIQUE index enforcing one ACTIVE pet_icon per pet.
--
-- TENANT ISOLATION NOTE
-- ---------------------
-- pet_documents deliberately has NO Row-Level Security and NO organization_id
-- column. This mirrors the existing pattern for pets / addresses / reports /
-- booking_events: tenancy is inherited through the FK chain
-- pet_id -> pets.user_id -> users.organization_id and enforced at the
-- application layer by always accessing the table via withTenant(). The
-- parent rows walked by those joins are themselves RLS-filtered, so a
-- cross-tenant pet is not visible and out-of-tenant writes touch zero rows.
--
-- DO NOT enable RLS on pet_documents.
-- ============================================================================

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- pets.icon_key — nullable; defaults applied in application code by pet type.
-- ----------------------------------------------------------------------------
ALTER TABLE "pets" ADD COLUMN "icon_key" text;

--> statement-breakpoint
-- Backfill existing pets with the appropriate stock default for their type.
UPDATE "pets" SET "icon_key" = CASE "type"
	WHEN 'cat' THEN 'stock/cat-default.png'
	WHEN 'dog' THEN 'stock/dog-default.png'
	ELSE 'stock/pet-default.png'
END
WHERE "icon_key" IS NULL;

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: pet_documents
-- ----------------------------------------------------------------------------
CREATE TABLE "pet_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"type" text NOT NULL,
	"r2_key" text NOT NULL,
	"original_filename" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "pet_documents_type_check" CHECK ("type" IN ('vaccination', 'weight_proof', 'pet_icon', 'medical', 'other')),
	CONSTRAINT "pet_documents_r2_key_unique" UNIQUE("r2_key")
);

--> statement-breakpoint
-- Foreign keys: documents cascade when their pet is deleted; uploader is
-- protected from deletion (RESTRICT), consistent with the rest of the schema.
ALTER TABLE "pet_documents" ADD CONSTRAINT "pet_documents_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "pet_documents" ADD CONSTRAINT "pet_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Partial indexes — only live (non-deleted) rows.
-- ----------------------------------------------------------------------------
CREATE INDEX "idx_pet_documents_pet_id_live" ON "pet_documents" ("pet_id") WHERE "deleted_at" IS NULL;

--> statement-breakpoint
CREATE INDEX "idx_pet_documents_type_live" ON "pet_documents" ("type") WHERE "deleted_at" IS NULL;

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Exactly one ACTIVE pet_icon per pet.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX "uniq_pet_icon_active" ON "pet_documents" ("pet_id") WHERE "type" = 'pet_icon' AND "deleted_at" IS NULL;
