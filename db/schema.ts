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
  "verification_pending",
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
  // Optional profile fields (populated via PATCH /api/users/me or guest data).
  name: text("name"),
  phone: text("phone"),
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
  // The pet being booked and the service address. Nullable at the DB level for
  // backward compatibility with pre-existing bookings, but set by the API on
  // creation. FK constraints keep referential integrity; tenancy is enforced by
  // withTenant + application checks (bookings itself is RLS-scoped).
  petId: uuid("pet_id").references(() => pets.id, { onDelete: "restrict" }),
  addressId: uuid("address_id").references(() => addresses.id, {
    onDelete: "restrict",
  }),
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
  // Guest booking contact details. NULL for logged-in users (their contact
  // data is resolved via user_id -> users). Set only when a booking is placed
  // unauthenticated; a guest user row is still created for the booking so the
  // guest can later sign in and manage it.
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  // Google Calendar event id, set when the booking is accepted and pushed to
  // the Owner's calendar; cleared when the booking is cancelled/rejected.
  googleEventId: text("google_event_id"),
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
  // Extended profile data (supplied later, not on the initial form).
  age: integer("age"),
  gender: text("gender"),
  habits: text("habits"),
  vaccinated: boolean("vaccinated"),
  sterilized: boolean("sterilized"),
  // Whether the pet has a contagious condition (surfaced to staff pre-visit).
  contagious: boolean("contagious").default(false),
  // Free-text appearance (colour, markings, personality) to help identify the pet.
  appearance: text("appearance"),
  notes: text("notes"),
  // Either a stock icon reference (e.g. 'stock/dog-01.png') or a user-uploaded
  // R2 key (e.g. 'pets/{petId}/pet_icon/{uuid}.jpg'). Nullable at the DB level;
  // application code defaults it by pet type on creation (see lib/pet-icons.ts).
  iconKey: text("icon_key"),
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
  // Access code / door code supplied by the customer for the visit.
  doorCode: text("door_code"),

  // Extended operational profile data (supplied after booking, to avoid
  // bloating the initial booking form). All nullable.
  estatePassword: text("estate_password"),
  keycardInfo: text("keycard_info"),
  foodAmount: text("food_amount"),
  foodLocation: text("food_location"),
  waterLocation: text("water_location"),
  toolsLocation: text("tools_location"),
  toysLocation: text("toys_location"),
  trashLocation: text("trash_location"),
  emergencyContact: text("emergency_contact"),
  primaryVet: text("primary_vet"),
  backupVet: text("backup_vet"),
  otherNotes: text("other_notes"),
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

// NOTE ON TENANT ISOLATION (pet_documents):
// -----------------------------------------------------------------------------
// `pet_documents` deliberately has NO Row-Level Security and NO organization_id
// column. This matches the established pattern for `pets`, `addresses`,
// `reports` and `booking_events`: tenancy is NOT enforced by a DB policy on
// this table, but INHERITED through the `pet_id -> pets.user_id -> users
// .organization_id` chain, and enforced at the application layer by ALWAYS
// accessing it through `withTenant(organizationId, ...)`. Because `withTenant`
// switches to the non-privileged `app_tenant` role and sets
// `app.current_organization_id`, the parent `users`/`pets` rows the joins walk
// through are themselves RLS-filtered, so a cross-tenant pet is simply not
// visible and any insert/select scoped to the wrong tenant touches zero rows.
//
// DO NOT enable RLS here and DO NOT query this table outside `withTenant`.
// -----------------------------------------------------------------------------
export const petDocuments = pgTable("pet_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  // Document kind. 'pet_icon' is a regular document that also drives
  // pets.icon_key (one active icon per pet, enforced by a partial unique
  // index created in the migration SQL).
  type: text("type").notNull(),
  r2Key: text("r2_key").notNull().unique(),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  notes: text("notes"),
});
// Partial indexes (WHERE deleted_at IS NULL) and the one-active-icon unique
// index are authored in drizzle/0003_pet_documents.sql, consistent with how
// RLS policies are authored (plain, inspectable SQL).

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
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bookings.organizationId],
    references: [organizations.id],
  }),
  // The customer who made the booking (the former `user` relation). Renamed to
  // `customer` so the API can use `.query.bookings.findMany({ with: { customer: true } })`
  // to satisfy the frontend's `BookingWithDetails` shape.
  customer: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  pet: one(pets, {
    fields: [bookings.petId],
    references: [pets.id],
  }),
  address: one(addresses, {
    fields: [bookings.addressId],
    references: [addresses.id],
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

export const petsRelations = relations(pets, ({ one, many }) => ({
  user: one(users, {
    fields: [pets.userId],
    references: [users.id],
  }),
  documents: many(petDocuments),
  bookings: many(bookings),
}));

export const petDocumentsRelations = relations(petDocuments, ({ one }) => ({
  pet: one(pets, {
    fields: [petDocuments.petId],
    references: [pets.id],
  }),
  uploader: one(users, {
    fields: [petDocuments.uploadedBy],
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
