-- ============================================================================
-- Migration 0007_users_profile_bookings_cancel
-- 1. users.name / users.phone — optional profile fields.
-- 2. bookings.cancellation_reason — reason captured when a booking is cancelled.
-- All columns nullable; existing rows unaffected.
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text;

--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" text;
