-- ============================================================================
-- Migration 0005_guest_bookings_pet_fields
-- 1. Guest bookings: bookings.guest_name / guest_email / guest_phone (nullable;
--    NULL for logged-in users).
-- 2. Pet health/description: pets.contagious (BOOLEAN DEFAULT FALSE) and
--    pets.appearance (TEXT).
--
-- All new columns are nullable (or defaulted), so existing rows are unaffected.
-- ============================================================================

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- bookings: guest contact details (NULL for authenticated users).
-- ----------------------------------------------------------------------------
ALTER TABLE "bookings" ADD COLUMN "guest_name" text;

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_email" text;

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_phone" text;

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- pets: contagious flag (defaults false) + free-text appearance.
-- ----------------------------------------------------------------------------
ALTER TABLE "pets" ADD COLUMN "contagious" boolean DEFAULT false;

--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "appearance" text;
