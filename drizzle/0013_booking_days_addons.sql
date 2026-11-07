-- ============================================================================
-- Migration 0013_booking_days_addons
-- Per-day add-on services as a JSONB array of line items: [{ id, name, price }].
-- Defaults to an empty array; NOT NULL.
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "booking_days" ADD COLUMN "add_ons" jsonb NOT NULL DEFAULT '[]'::jsonb;
