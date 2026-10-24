-- ============================================================================
-- Migration 0008_detailed_profiles
-- Extended operational profile data (supplied after booking so the initial
-- form stays lean). All columns NULLABLE; existing rows unaffected.
--   addresses: estate/keycard/food/water/tools/toys/trash/emergency/vet/notes
--   pets: age, habits (gender already exists)
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "estate_password" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "keycard_info" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "food_amount" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "food_location" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "water_location" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "tools_location" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "toys_location" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "trash_location" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "emergency_contact" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "primary_vet" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "backup_vet" text;

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "other_notes" text;

--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "age" integer;

--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "habits" text;
