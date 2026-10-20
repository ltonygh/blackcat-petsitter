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
  weightKg: number | null;
  gender: string | null;
  vaccinated: boolean;
  sterilized: boolean;
  notes: string | null;
  iconKey: string | null; // Stock path (e.g. 'stock/dog-01.png') or R2 key
}

export interface Booking {
  id: string;
  userId: string;
  staffId: string | null;
  serviceType: string; // e.g. 'Dog Sitting', 'Cat Sitting (Standard)'
  startTime: string; // ISO string
  endTime: string; // ISO string
  status: BookingStatus;
  totalHkd: number;
  conflictFlag: boolean;
  fitInFlag: boolean;
  proposalStartTime: string | null;
  proposalEndTime: string | null;
  proposalReason: string | null;
  proposalStatus: "pending" | "accepted" | "declined" | null;
}

export interface PetDocument {
  id: string;
  petId: string;
  type: "vaccination" | "weight_proof" | "pet_icon";
  r2Key: string;
  originalFilename: string | null;
}
