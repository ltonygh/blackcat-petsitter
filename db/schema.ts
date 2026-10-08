import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Multi-tenant schema for Blackcat.petsitter.
 *
 * Conventions (see task constraints):
 *  - Every primary key is `uuid` with `DEFAULT gen_random_uuid()`
 *    (Postgres 13+ built-in; no extensions required).
 *  - Every timestamp is `TIMESTAMPTZ` (UTC) with `DEFAULT NOW()`.
 *  - Soft deletes (`deleted_at`) exist ONLY on `users` and `bookings`.
 *  - `organization_id` is the tenancy root. Row-Level Security is enabled
 *    on `organizations`, `users`, `bookings` and `transport_fee_rules`
 *    (authored by hand in the SQL migration, NOT here). All other tables
 *    inherit tenancy through FK chains and are scoped at the application
 *    layer via `withTenant()`.
 *  - Foreign keys referencing users/organizations use ON DELETE RESTRICT;
 *    `booking_events.booking_id` and `reports.booking_id` use ON DELETE CASCADE.
 */

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

// Booking lifecycle states.
export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "accepted",
  "time_proposed",
  "paid",
  "completed",
  "cancelled",
  "rejected",
]);

// Application roles.
export const userRole = pgEnum("user_role", ["user", "owner", "staff"]);

/* -------------------------------------------------------------------------- */
/* Tables with organization_id (RLS-enabled)                                   */
/* -------------------------------------------------------------------------- */

// Tenant root. Tenancy key for the whole system.
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Application users. Soft-deleted via deleted_at.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),
  email: text("email").notNull().unique(),
  googleId: text("google_id"),
  role: userRole("role").notNull().default("user"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Bookings. Soft-deleted via deleted_at.
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").references(() => users.id, {
    onDelete: "restrict",
  }),
  serviceType: text("service_type").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: bookingStatus("status").notNull().default("pending"),
  totalHkd: integer("total_hkd").notNull(),
  conflictFlag: boolean("conflict_flag").default(false),
  fitInFlag: boolean("fit_in_flag").default(false),
  proposalStartTime: timestamp("proposal_start_time", { withTimezone: true }),
  proposalEndTime: timestamp("proposal_end_time", { withTimezone: true }),
  proposalReason: text("proposal_reason"),
  proposalStatus: text("proposal_status"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Transport fee rules per organization.
export const transportFeeRules = pgTable("transport_fee_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),
  modeCombination: text("mode_combination").notNull(),
  feeHkd: integer("fee_hkd").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Tables WITHOUT organization_id (tenancy inherited via FK chains)            */
/* -------------------------------------------------------------------------- */

// Immutable audit trail of booking status transitions.
export const bookingEvents = pgTable("booking_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "restrict",
  }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Pets owned by a user.
export const pets = pgTable("pets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  breed: text("breed"),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
  gender: text("gender"),
  vaccinated: boolean("vaccinated"),
  sterilized: boolean("sterilized"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Service addresses belonging to a user.
export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  label: text("label"),
  fullAddress: text("full_address").notNull(),
  nearestMtr: text("nearest_mtr"),
  walkingMinutes: integer("walking_minutes"),
  requiresTransportChange: boolean("requires_transport_change"),
  accessTier: text("access_tier"),
  surchargeHkd: integer("surcharge_hkd"),
  transportModes: text("transport_modes"),
  manualOverride: boolean("manual_override").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Staff reports attached to a booking.
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Geocoding/classification cache keyed by a hash of the address.
export const addressCache = pgTable("address_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  addressHash: text("address_hash").notNull().unique(),
  fullAddress: text("full_address").notNull(),
  nearestMtr: text("nearest_mtr"),
  walkingMinutes: integer("walking_minutes"),
  requiresTransportChange: boolean("requires_transport_change"),
  accessTier: text("access_tier"),
  surchargeHkd: integer("surcharge_hkd"),
  transportModes: text("transport_modes"),
  classifiedAt: timestamp("classified_at", { withTimezone: true }),
  manualOverride: boolean("manual_override").default(false),
});

// Travel-time cache between two hashed locations.
export const travelTimeCache = pgTable(
  "travel_time_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originHash: text("origin_hash").notNull(),
    destinationHash: text("destination_hash").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }),
  },
  (table) => [
    unique("travel_time_cache_origin_destination_key").on(
      table.originHash,
      table.destinationHash,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations (used by the Drizzle query builder; no DB effect)                 */
/* -------------------------------------------------------------------------- */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  bookings: many(bookings),
  transportFeeRules: many(transportFeeRules),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  pets: many(pets),
  addresses: many(addresses),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bookings.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  events: many(bookingEvents),
  reports: many(reports),
}));

export const bookingEventsRelations = relations(bookingEvents, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingEvents.bookingId],
    references: [bookings.id],
  }),
}));

export const petsRelations = relations(pets, ({ one }) => ({
  user: one(users, {
    fields: [pets.userId],
    references: [users.id],
  }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  booking: one(bookings, {
    fields: [reports.bookingId],
    references: [bookings.id],
  }),
}));
