/**
 * Single source of truth for service types + pricing.
 * Shared by the Booking Wizard (app/book/page.tsx) and the Home Page
 * pricing table (app/page.tsx) so the two can never drift apart.
 */

export const SERVICE_TYPES = [
  "Dog Sitting",
  "Cat Sitting (Standard)",
  "Cat Sitting (Express)",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const MAX_CATS = 5;

export interface ServiceMeta {
  value: ServiceType;
  label: string;
  subtitle: string;
  icon: string;
  duration: string;
  /** Numeric slot length in minutes — drives the auto-computed end time. */
  durationMinutes: number;
  petType: "dog" | "cat";
}

export const SERVICE_META: Record<ServiceType, ServiceMeta> = {
  "Dog Sitting": {
    value: "Dog Sitting",
    label: "狗狗保姆",
    subtitle: "Dog Sitting",
    icon: "\u{1F415}",
    duration: "45–60 分鐘",
    durationMinutes: 60,
    petType: "dog",
  },
  "Cat Sitting (Standard)": {
    value: "Cat Sitting (Standard)",
    label: "貓貓保姆（標準）",
    subtitle: "Cat Sitting (Standard)",
    icon: "\u{1F408}",
    duration: "45–60 分鐘",
    durationMinutes: 60,
    petType: "cat",
  },
  "Cat Sitting (Express)": {
    value: "Cat Sitting (Express)",
    label: "貓貓保姆（特快）",
    subtitle: "Cat Sitting (Express)",
    icon: "\u{26A1}",
    duration: "15–20 分鐘",
    durationMinutes: 20,
    petType: "cat",
  },
};

/** A priced line item — mirrors the backend's `BookingLineItem` exactly. */
export interface BookingLineItem {
  id: string;
  name: string;
  price: number;
}

/* ─────────────────────────── Add-ons ─────────────────────────── */

export type AddOnId =
  | "nailCutting"
  | "earCleaning"
  | "pillFeeding"
  | "injection"
  | "subcutaneousFluid";

/** Pill-count tiers: the price depends on how many pills are given. */
export const PILL_TIERS = [
  { id: "1-5", label: "1–5 粒", price: 30 },
  { id: "6-10", label: "6–10 粒", price: 50 },
  { id: "11+", label: "11+ 粒", price: 100 },
] as const;

export type PillTierId = (typeof PILL_TIERS)[number]["id"];

export interface AddOnDef {
  id: AddOnId;
  label: string;
  /** Flat price. Unused for pill-feeding, which prices by tier. */
  price: number | null;
}

export const ADD_ON_DEFS: AddOnDef[] = [
  { id: "nailCutting", label: "剪指甲 Nail-cutting", price: 30 },
  { id: "earCleaning", label: "清潔耳朵 Ear-cleaning", price: 30 },
  // `price: null` → user must pick a PILL_TIERS option.
  { id: "pillFeeding", label: "餵藥 Pill-feeding", price: null },
  { id: "injection", label: "注射 Injection", price: 50 },
  {
    id: "subcutaneousFluid",
    label: "皮下輸液 Subcutaneous fluid injection",
    price: 100,
  },
];

export type SelectedAddOns = Partial<Record<AddOnId, boolean>>;

/** Price of a single add-on given the current pill tier. */
export function addOnPrice(
  id: AddOnId,
  pillTier: PillTierId,
): number | null {
  if (id === "pillFeeding") {
    return PILL_TIERS.find((t) => t.id === pillTier)?.price ?? null;
  }
  return ADD_ON_DEFS.find((d) => d.id === id)?.price ?? null;
}

/** Build the priced line items for the selected add-ons. */
export function buildAddOns(
  selected: SelectedAddOns,
  pillTier: PillTierId,
): BookingLineItem[] {
  const items: BookingLineItem[] = [];
  for (const def of ADD_ON_DEFS) {
    if (!selected[def.id]) continue;
    const price = addOnPrice(def.id, pillTier);
    if (price === null) continue;
    items.push({
      id: def.id,
      name: def.label,
      price,
    });
  }
  return items;
}

/* ─────────────────────── T&C surcharges ─────────────────────── */

export const RUSH_SURCHARGE = 30;
export const OUT_OF_HOURS_SURCHARGE = 50;
/** A booking within this many days of today is "rush". */
export const RUSH_WINDOW_DAYS = 3;
/** Regular service window, inclusive. */
export const SERVICE_START_HOUR = 9;
export const SERVICE_END_HOUR = 21;

/**
 * Days from today to `dateISO` (YYYY-MM-DD). Compares calendar dates only,
 * so "tomorrow" is always 1 regardless of the current time of day.
 */
export function daysUntil(dateISO: string): number | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / 86_400_000);
}

/** Rush applies when the booking is < 3 days away (0–2 days). */
export function isRushBooking(dateISO: string): boolean {
  const days = daysUntil(dateISO);
  return days !== null && days >= 0 && days < RUSH_WINDOW_DAYS;
}

/** Out of hours when starting before 09:00 or at/after 21:00. */
export function isOutOfHours(startTime: string): boolean {
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  const minutes = h * 60 + m;
  return (
    minutes < SERVICE_START_HOUR * 60 || minutes >= SERVICE_END_HOUR * 60
  );
}

/** Surcharges derived from the chosen date + start time (never user-toggled). */
export function buildSurcharges(
  dateISO: string,
  startTime: string,
): BookingLineItem[] {
  const items: BookingLineItem[] = [];
  if (isRushBooking(dateISO)) {
    items.push({
      id: "rushAppointment",
      name: "加急預約 Rush appointment",
      price: RUSH_SURCHARGE,
    });
  }
  if (isOutOfHours(startTime)) {
    items.push({
      id: "outOfHours",
      name: "非服務時間 Out of regular timeframe",
      price: OUT_OF_HOURS_SURCHARGE,
    });
  }
  return items;
}

/** Dogs at or above this weight fall into the heavier price band. */
export const DOG_HEAVY_WEIGHT_KG = 15;
/** Cats included in the base fee; every cat beyond this is +$20. */
export const CATS_INCLUDED_IN_BASE = 2;
export const EXTRA_CAT_FEE = 20;

export const PRICES = {
  dogStandard: 250,
  dogHeavy: 300,
  catStandard: 250,
  catExpress: 200,
} as const;

export interface PriceInput {
  serviceType: ServiceType;
  /** Raw weight input from the form; ignored for cat services. */
  petWeight?: string | number | null;
  /** Total number of cats in the household (1–5). Clamped internally. */
  catCount?: number | null;
  /** Selected add-ons (already priced). */
  addOns?: BookingLineItem[];
  /** Auto-derived T&C surcharges. */
  surcharges?: BookingLineItem[];
}

export interface PriceBreakdown {
  total: number;
  /** Human readable explanation, e.g. "基本 $250 + 額外 1 隻貓 $20". */
  notes: string[];
  /** Extra cats beyond the 2 included in the base fee. */
  extraCats: number;
  /** true when a dog's weight pushed it into the $300 band. */
  heavyDog: boolean;
  /** Base service fee only (before add-ons/surcharges). */
  base: number;
  addOnsTotal: number;
  surchargesTotal: number;
}

function toWeight(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clampCatCount(value: number | null | undefined): number {
  const n = Math.floor(Number(value ?? 1));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_CATS, n);
}

/**
 * Calculates the base service fee for a booking.
 *
 * Dog Sitting          → $250, or $300 when the dog weighs >= 15kg
 * Cat Sitting Standard → $250 for up to 2 cats, +$20 per extra cat
 * Cat Sitting Express  → $200 for up to 2 cats, +$20 per extra cat
 */
export function calcPrice(input: PriceInput): PriceBreakdown {
  const notes: string[] = [];
  const addOns = input.addOns ?? [];
  const surcharges = input.surcharges ?? [];
  const addOnsTotal = addOns.reduce((sum, i) => sum + i.price, 0);
  const surchargesTotal = surcharges.reduce((sum, i) => sum + i.price, 0);

  if (input.serviceType === "Dog Sitting") {
    const weight = toWeight(input.petWeight);
    const heavyDog = weight >= DOG_HEAVY_WEIGHT_KG;
    const base = heavyDog ? PRICES.dogHeavy : PRICES.dogStandard;
    if (heavyDog) {
      notes.push(
        `基本 $${PRICES.dogHeavy}（狗狗體重 ${weight}kg ≥ ${DOG_HEAVY_WEIGHT_KG}kg）`,
      );
    } else {
      notes.push(`基本 $${PRICES.dogStandard}（狗狗體重 < ${DOG_HEAVY_WEIGHT_KG}kg）`);
    }
    for (const item of addOns) notes.push(`${item.name} +$${item.price}`);
    for (const item of surcharges) notes.push(`${item.name} +$${item.price}`);
    return {
      total: base + addOnsTotal + surchargesTotal,
      notes,
      extraCats: 0,
      heavyDog,
      base,
      addOnsTotal,
      surchargesTotal,
    };
  }

  const base =
    input.serviceType === "Cat Sitting (Express)"
      ? PRICES.catExpress
      : PRICES.catStandard;
  const catCount = clampCatCount(input.catCount);
  const extraCats = Math.max(0, catCount - CATS_INCLUDED_IN_BASE);
  const extraFee = extraCats * EXTRA_CAT_FEE;

  notes.push(`基本 $${base}（最多 ${CATS_INCLUDED_IN_BASE} 隻貓）`);
  if (extraCats > 0) {
    notes.push(`額外 ${extraCats} 隻貓 × $${EXTRA_CAT_FEE} = $${extraFee}`);
  }
  for (const item of addOns) notes.push(`${item.name} +$${item.price}`);
  for (const item of surcharges) notes.push(`${item.name} +$${item.price}`);

  return {
    // Extra cats are part of the base fee, not a line item.
    total: base + extraFee + addOnsTotal + surchargesTotal,
    notes,
    extraCats,
    heavyDog: false,
    base: base + extraFee,
    addOnsTotal,
    surchargesTotal,
  };
}

/** Convenience wrapper when only the total is needed. */
export function priceFor(input: PriceInput): number {
  return calcPrice(input).total;
}

/* ───────────────────────── Home page copy ───────────────────────── */

export interface ServiceColumn {
  service: ServiceType;
  name: string;
  baseFee: string[];
  duration: string;
}

export const PRICING_COLUMNS: ServiceColumn[] = [
  {
    service: "Dog Sitting",
    name: "狗狗保姆 (Dog Sitting)",
    baseFee: ["$250（<15kg）", "$300（≥15kg）"],
    duration: "45–60 分鐘",
  },
  {
    service: "Cat Sitting (Standard)",
    name: "貓貓保姆（標準）",
    baseFee: ["$250（最多 2 隻貓）", "+$20 每隻額外貓"],
    duration: "45–60 分鐘",
  },
  {
    service: "Cat Sitting (Express)",
    name: "貓貓保姆（特快）",
    baseFee: ["$200（最多 2 隻貓）", "+$20 每隻額外貓"],
    duration: "15–20 分鐘",
  },
];

export type IncludedCell = "yes" | "no" | "optional";

export interface IncludedTaskRow {
  task: string;
  values: [IncludedCell, IncludedCell, IncludedCell];
}

export const INCLUDED_TASKS: IncludedTaskRow[] = [
  { task: "餵食 Feeding", values: ["yes", "yes", "yes"] },
  { task: "更換飲用水 Change feeding water", values: ["yes", "yes", "yes"] },
  { task: "清潔寵物用品及生活空間 Clean pet items and living space", values: ["yes", "yes", "yes"] },
  { task: "更換尿片 Change diapers", values: ["yes", "no", "no"] },
  { task: "處理排泄物 Waste disposal", values: ["yes", "yes", "yes"] },
  { task: "玩耍及梳理 Playing / Grooming", values: ["yes", "yes", "no"] },
  { task: "散步 Walking", values: ["yes", "no", "no"] },
  { task: "視像通話 FaceTime", values: ["optional", "optional", "no"] },
];

export interface AddOnRow {
  name: string;
  price: string[];
}

export const ADD_ONS: AddOnRow[] = [
  { name: "剪指甲 Nail-cutting", price: ["+ $30"] },
  { name: "清潔耳朵 Ear-cleaning", price: ["+ $30"] },
  { name: "餵藥 Pill-feeding", price: ["+$30（1–5 粒）", "+$50（6–10 粒）", "+$100（11+ 粒）"] },
  { name: "注射 Injection", price: ["+ $50"] },
  { name: "皮下輸液 Subcutaneous fluid injection", price: ["+ $100"] },
];

export const SURCHARGES: AddOnRow[] = [
  { name: "緊急預約 Rush appointment（< 3 日前預約）", price: ["+$30 / 次 起"] },
  { name: "非標準時段 Out of regular timeframe（09:00 前 / 21:00 後）", price: ["+$50 / 次 起"] },
];
