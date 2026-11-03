-- ============================================================================
-- Migration 0011_bookings_previous_total_hkd
-- Captures the ORIGINAL total the first time the Owner overrides it, so the
-- user dashboard can show a "was X, now Y" indicator. NULLABLE (null until
-- the first adjustment; never overwritten afterwards).
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "previous_total_hkd" integer;
