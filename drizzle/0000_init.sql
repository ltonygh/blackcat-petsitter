-- ============================================================================
-- Migration 0000_init
-- Initial multi-tenant schema for Blackcat.petsitter.
--
-- This file is plain, inspectable SQL (no `drizzle-kit push` was used).
-- It contains:
--   1. Enums
--   2. Tables (UUID PKs via gen_random_uuid(), TIMESTAMPTZ columns)
--   3. Foreign keys (RESTRICT for user/org refs, CASCADE for event/report refs)
--   4. Row-Level Security (RLS) for the four organization-scoped tables
--
-- RLS model:
--   * Tables WITH organization_id  -> RLS enabled, strict policy keyed on
--     current_setting('app.current_organization_id', true)::uuid.
--     If the setting is unset/empty, current_setting(..., true) returns NULL,
--     the policy predicate is NULL (not true), and ZERO rows are visible.
--   * Tables WITHOUT organization_id (booking_events, pets, addresses,
--     reports, address_cache, travel_time_cache) -> RLS is intentionally NOT
--     enabled; tenancy is enforced at the application layer via withTenant().
-- ============================================================================

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'accepted', 'time_proposed', 'paid', 'completed', 'cancelled', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'owner', 'staff');

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: organizations  (tenant root; RLS-enabled)
-- ----------------------------------------------------------------------------
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: users  (RLS-enabled; soft-deleted via deleted_at)
-- ----------------------------------------------------------------------------
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"google_id" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: bookings  (RLS-enabled; soft-deleted via deleted_at)
-- ----------------------------------------------------------------------------
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_id" uuid,
	"service_type" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"total_hkd" integer NOT NULL,
	"conflict_flag" boolean DEFAULT false,
	"fit_in_flag" boolean DEFAULT false,
	"proposal_start_time" timestamp with time zone,
	"proposal_end_time" timestamp with time zone,
	"proposal_reason" text,
	"proposal_status" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: booking_events  (no organization_id; tenancy via booking_id chain)
-- ----------------------------------------------------------------------------
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_id" uuid,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: pets  (no organization_id; tenancy via user_id chain)
-- ----------------------------------------------------------------------------
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"breed" text,
	"weight_kg" numeric(5, 2),
	"gender" text,
	"vaccinated" boolean,
	"sterilized" boolean,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: addresses  (no organization_id; tenancy via user_id chain)
-- ----------------------------------------------------------------------------
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"full_address" text NOT NULL,
	"nearest_mtr" text,
	"walking_minutes" integer,
	"requires_transport_change" boolean,
	"access_tier" text,
	"surcharge_hkd" integer,
	"transport_modes" text,
	"manual_override" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: reports  (no organization_id; tenancy via booking_id chain)
-- ----------------------------------------------------------------------------
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: transport_fee_rules  (RLS-enabled)
-- ----------------------------------------------------------------------------
CREATE TABLE "transport_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mode_combination" text NOT NULL,
	"fee_hkd" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: address_cache  (global cache; no tenancy)
-- ----------------------------------------------------------------------------
CREATE TABLE "address_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_hash" text NOT NULL,
	"full_address" text NOT NULL,
	"nearest_mtr" text,
	"walking_minutes" integer,
	"requires_transport_change" boolean,
	"access_tier" text,
	"surcharge_hkd" integer,
	"transport_modes" text,
	"classified_at" timestamp with time zone,
	"manual_override" boolean DEFAULT false,
	CONSTRAINT "address_cache_address_hash_unique" UNIQUE("address_hash")
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Table: travel_time_cache  (global cache; no tenancy)
-- ----------------------------------------------------------------------------
CREATE TABLE "travel_time_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_hash" text NOT NULL,
	"destination_hash" text NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"calculated_at" timestamp with time zone,
	CONSTRAINT "travel_time_cache_origin_destination_key" UNIQUE("origin_hash","destination_hash")
);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- Foreign keys
-- user/organization references use ON DELETE RESTRICT;
-- booking_events.booking_id and reports.booking_id use ON DELETE CASCADE.
-- ----------------------------------------------------------------------------
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transport_fee_rules" ADD CONSTRAINT "transport_fee_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
-- Policy predicate used everywhere:
--   organization_id = current_setting('app.current_organization_id', true)::uuid
-- The second arg `true` = "missing_ok": when the setting is absent the call
-- returns NULL instead of erroring, so `= NULL` yields NULL (not true) and
-- the row is filtered out. => strict deny-by-default when no tenant is set.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS: organizations
-- ----------------------------------------------------------------------------
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- FORCE applies RLS even to the table OWNER. Required on Neon, where the app
-- connects as the table owner (owners bypass RLS unless forced).
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Policy: a tenant may only see its own organization row (matched by id).
CREATE POLICY "organizations_tenant_isolation" ON "organizations"
	AS PERMISSIVE FOR ALL
	USING ("id" = current_setting('app.current_organization_id', true)::uuid)
	WITH CHECK ("id" = current_setting('app.current_organization_id', true)::uuid);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- RLS: users
-- ----------------------------------------------------------------------------
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- FORCE applies RLS even to the table OWNER (see note above).
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Policy: users are visible/writable only within their own organization.
CREATE POLICY "users_tenant_isolation" ON "users"
	AS PERMISSIVE FOR ALL
	USING ("organization_id" = current_setting('app.current_organization_id', true)::uuid)
	WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true)::uuid);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- RLS: bookings
-- ----------------------------------------------------------------------------
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- FORCE applies RLS even to the table OWNER (see note above).
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Policy: bookings are visible/writable only within their own organization.
CREATE POLICY "bookings_tenant_isolation" ON "bookings"
	AS PERMISSIVE FOR ALL
	USING ("organization_id" = current_setting('app.current_organization_id', true)::uuid)
	WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true)::uuid);

--> statement-breakpoint
-- ----------------------------------------------------------------------------
-- RLS: transport_fee_rules
-- ----------------------------------------------------------------------------
ALTER TABLE "transport_fee_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- FORCE applies RLS even to the table OWNER (see note above).
ALTER TABLE "transport_fee_rules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Policy: transport fee rules are visible/writable only within their own organization.
CREATE POLICY "transport_fee_rules_tenant_isolation" ON "transport_fee_rules"
	AS PERMISSIVE FOR ALL
	USING ("organization_id" = current_setting('app.current_organization_id', true)::uuid)
	WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true)::uuid);

--> statement-breakpoint
-- NOTE: booking_events, pets, addresses, reports, address_cache and
-- travel_time_cache deliberately have NO RLS. They are scoped at the
-- application layer via withTenant(), which sets the org id for the
-- transaction so that queries joining through users.bookings/bookings are
-- constrained by the parent tables above.
