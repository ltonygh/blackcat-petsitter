/**
 * Shared frontend data contracts.
 *
 * These mirror the shapes returned by the backend API and are used throughout
 * the UI. They are intentionally decoupled from the Drizzle schema so the
 * frontend never imports server-only code.
 */

export type Role = "user" | "owner" | "staff";

export type BookingStatus =
  | "pending"
  | "accepted"
  | "time_proposed"
  | "verification_pending"
  | "paid"
  | "completed"
  | "cancelled"
  | "rejected";

export interface User {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
}

export interface Pet {
  id: string;
  userId: string;
  name: string;
  type: "cat" | "dog" | "other";
  breed: string | null;
  /** Drizzle `numeric` serializes as a decimal string (e.g. "4.50"). */
  weightKg: string | null;
  gender: string | null;
  vaccinated: boolean | null;
  sterilized: boolean | null;
  contagious: boolean | null;
  appearance: string | null;
  notes: string | null;
  iconKey: string | null;
}

export interface Booking {
  id: string;
  userId: string;
  addressId: string;
  petId: string;
  staffId: string | null;
  serviceType: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  totalHkd: number;
  conflictFlag: boolean;
  fitInFlag: boolean;
  proposalStartTime: string | null;
  proposalEndTime: string | null;
  proposalReason: string | null;
  proposalStatus: "pending" | "accepted" | "declined" | null;
  /** Reason recorded when a customer or owner cancels a booking. */
  cancellationReason: string | null;
  /**
   * Guest contact details, stored on the booking row itself. NULL for
   * logged-in users (their contact data is resolved via `customer`).
   */
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
}

/** Enriched booking returned by GET /api/bookings (role-scoped). */
export interface BookingWithDetails extends Booking {
  /**
   * Full pet row, eager-loaded server-side (`with: { pet: true }`), so
   * contagious/appearance/notes are all present.
   */
  pet: {
    id: string;
    name: string;
    type: string;
    iconKey: string | null;
    breed?: string | null;
    weightKg?: string | number | null;
    vaccinated?: boolean | null;
    sterilized?: boolean | null;
    contagious?: boolean | null;
    appearance?: string | null;
    notes?: string | null;
  } | null;
  customer: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
  } | null;
  /** Full address row, eager-loaded server-side. */
  address: {
    id: string;
    userId: string;
    label: string | null;
    fullAddress: string;
    doorCode: string | null;
  } | null;
}

/**
 * Full address object. Kept as a distinct name for callers that build an
 * address independently of a booking.
 */
export interface AddressRecord {
  id: string;
  userId: string;
  label: string | null;
  fullAddress: string;
  doorCode: string | null;
}

export interface Address {
  id: string;
  label: string | null;
  fullAddress: string;
}

export interface PetDocument {
  id: string;
  petId: string;
  type: "vaccination" | "weight_proof" | "pet_icon";
  r2Key: string;
  originalFilename: string | null;
}
