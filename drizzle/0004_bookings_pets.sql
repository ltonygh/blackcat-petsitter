-- ============================================================================
-- Migration 0004_bookings_pets
-- 1. Adds 'verification_pending' to the booking_status enum (manual PayMe flow).
-- 2. Adds bookings.pet_id and bookings.address_id (FKs) so a booking references
--    the pet being booked and the service address. Both nullable for backward
--    compatibility with pre-existing rows; the API sets them on creation.
--
-- Enum ordering: 'verification_pending' is inserted BEFORE 'paid' to match the
-- lifecycle pending -> accepted -> time_proposed -> verification_pending -> paid
-- -> completed -> cancelled -> rejected.
--
-- NOTE ON ALTER TYPE ... ADD VALUE INSIDE A TRANSACTION
-- ----------------------------------------------------
-- Since PostgreSQL 12 an enum value may be added inside a transaction block,
-- provided the new value is NOT used later in the SAME transaction. Drizzle's
-- migrator runs each migration in a transaction, so we add the value first and
-- never reference 'verification_pending' in this file. This is safe on the
-- deployed Neon instance (PostgreSQL 16+).
-- ============================================================================

--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'verification_pending' BEFORE 'paid';

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- bookings.pet_id / bookings.address_id — nullable FKs.
-- ON DELETE RESTRICT matches the existing user/organization references so a
-- pet or address in use by a booking cannot be silently removed.
-- ----------------------------------------------------------------------------
ALTER TABLE "bookings" ADD COLUMN "pet_id" uuid;

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "address_id" uuid;

--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;
