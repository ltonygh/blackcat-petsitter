-- ============================================================================
-- Migration 0006_address_door_code
-- Adds addresses.door_code — the access/door code supplied by the customer for
-- a visit. The guest booking request body carries addressData.doorCode, so we
-- persist it rather than dropping it. Nullable; existing rows unaffected.
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "door_code" text;
