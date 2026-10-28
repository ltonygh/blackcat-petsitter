-- ============================================================================
-- Migration 0010_bookings_addons_surcharges
-- Optional add-on services + T&C surcharges stored as JSONB arrays of line
-- items: [{ id, name, price }]. Defaults to an empty array; NOT NULL.
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "add_ons" jsonb NOT NULL DEFAULT '[]'::jsonb;

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "surcharges" jsonb NOT NULL DEFAULT '[]'::jsonb;
