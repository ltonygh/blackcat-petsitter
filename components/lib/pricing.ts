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

/**
 * Add minutes to an "HH:mm" string, wrapping at midnight.
 * Shared by the booking wizard and the owner's "propose new time" modal so
 * both derive the end time from the same service duration.
 */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const total = (h * 60 + m + minutes) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** End time implied by a start time and the service's slot length. */
export function estimateEndTime(startTime: string, service: string): string {
  const meta = SERVICE_META[service as ServiceType];
  if (!meta) return startTime;
  return addMinutes(startTime, meta.durationMinutes);
}

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
  | "pillFeeding1_5"
  | "pillFeeding6_10"
  | "pillFeeding11plus"
  | "injection"
  | "subcutaneousFluid";

/**
 * Pill-count tiers. Each tier is offered as its own add-on checkbox
 * (`pillFeeding1_5` / `pillFeeding6_10` / `pillFeeding11plus`), so there is
 * no separate tier dropdown. Retained as the single source for tier pricing
 * and the labels used on the homepage pricing board.
 */
export const PILL_TIERS = [
  { id: "1-5", label: "1–5 粒", price: 30, addOnId: "pillFeeding1_5" },
  { id: "6-10", label: "6–10 粒", price: 50, addOnId: "pillFeeding6_10" },
  { id: "11+", label: "11+ 粒", price: 100, addOnId: "pillFeeding11plus" },
] as const satisfies readonly {
  id: string;
  label: string;
  price: number;
  addOnId: AddOnId;
}[];

export interface AddOnDef {
  id: AddOnId;
  label: string;
  /** Flat price. Unused for pill-feeding, which prices by tier. */
  price: number | null;
}

export const ADD_ON_DEFS: AddOnDef[] = [
  { id: "nailCutting", label: "剪指甲 Nail-cutting", price: 30 },
  { id: "earCleaning", label: "清潔耳朵 Ear-cleaning", price: 30 },
  // Pill-feeding is offered as three flat-priced tiers (no separate dropdown),
  // so the UI stays a plain checkbox list and the price is captured exactly.
  { id: "pillFeeding1_5", label: "餵藥 (1–5 粒) Pill-feeding", price: 30 },
  { id: "pillFeeding6_10", label: "餵藥 (6–10 粒) Pill-feeding", price: 50 },
  { id: "pillFeeding11plus", label: "餵藥 (11+ 粒) Pill-feeding", price: 100 },
  { id: "injection", label: "注射 Injection", price: 50 },
  {
    id: "subcutaneousFluid",
    label: "皮下輸液 Subcutaneous fluid injection",
    price: 100,
  },
];

export type SelectedAddOns = Partial<Record<AddOnId, boolean>>;

/** Flat price of a single add-on (pill-feeding tiers are their own ids). */
export function addOnPrice(id: AddOnId): number | null {
  return ADD_ON_DEFS.find((d) => d.id === id)?.price ?? null;
}

/** Build the priced line items for the selected add-ons. */
export function buildAddOns(selected: SelectedAddOns): BookingLineItem[] {
  const items: BookingLineItem[] = [];
  for (const def of ADD_ON_DEFS) {
    if (!selected[def.id]) continue;
    const price = addOnPrice(def.id);
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
  return buildSurchargesForDays([{ date: dateISO, startTime }]);
}

/**
 * Surcharges across a multi-day booking.
 *
 * - Rush (+$30): charged ONCE per booking, keyed on the first (earliest) day.
 * - Out of hours (+$50): charged PER DAY, for each day whose start time falls
 *   outside 09:00–21:00. Days with no chosen time cannot be out of hours.
 */
export function buildSurchargesForDays(
  days: { date: string; startTime: string | null }[],
): BookingLineItem[] {
  const items: BookingLineItem[] = [];
  const first = days[0];
  if (first && isRushBooking(first.date)) {
    items.push({
      id: "rushAppointment",
      name: "加急預約 Rush appointment",
      price: RUSH_SURCHARGE,
    });
  }
  const outOfHoursDays = days.filter(
    (d) => d.startTime !== null && isOutOfHours(d.startTime),
  ).length;
  if (outOfHoursDays > 0) {
    items.push({
      id: "outOfHours",
      name:
        outOfHoursDays === 1
          ? "非服務時間 Out of regular timeframe"
          : `非服務時間 Out of regular timeframe（${outOfHoursDays} 天）`,
      price: OUT_OF_HOURS_SURCHARGE * outOfHoursDays,
    });
  }
  return items;
}

/** Dogs at or above this weight fall into the heavier price band. */
export const DOG_HEAVY_WEIGHT_KG = 15;/** Cats included in the base fee; every cat beyond this is +$20. */
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
  /** Legacy flat add-ons (priced). Ignored when `perDayAddOns` is given. */
  addOns?: BookingLineItem[];
  /**
   * Per-day add-ons for multi-day bookings. Each entry is that day's own
   * selection; arrays may differ in length and content.
   */
  perDayAddOns?: BookingLineItem[][];
  /** Auto-derived T&C surcharges. */
  surcharges?: BookingLineItem[];
  /**
   * Number of service days for a multi-day booking (default 1). Base fee and
   * add-ons are charged per day; surcharges arrive already multiplied.
   */
  dayCount?: number;
}

export interface PriceBreakdown {
  total: number;
  /** Human readable explanation, e.g. "基本 $250 + 額外 1 隻貓 $20". */
  notes: string[];
  /** Extra cats beyond the 2 included in the base fee. */
  extraCats: number;
  /** true when a dog's weight pushed it into the $300 band. */
  heavyDog: boolean;
  /** Base service fee only (before add-ons/surcharges), for ONE day. */
  base: number;
  addOnsTotal: number;
  surchargesTotal: number;
  /** Days billed (>= 1). */
  dayCount: number;
  /** Per-day base fee including any extra-cat charge. */
  dailyBase: number;
  /** Per-day add-on subtotal (single-visit bookings only). */
  dailyAddOns: number;
  /** Total of all add-ons across every day. */
  totalAddOns: number;
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
  const dayCount = Math.max(1, Math.floor(Number(input.dayCount ?? 1)) || 1);
  const surcharges = input.surcharges ?? [];
  const surchargesTotal = surcharges.reduce((sum, i) => sum + i.price, 0);

  /**
   * Add-ons per day. `perDayAddOns` wins when present (multi-day, each day
   * has its own selection); otherwise fall back to the flat `addOns` array
   * repeated for every day, which keeps single-visit callers unchanged.
   */
  const perDayAddOns: BookingLineItem[][] = input.perDayAddOns
    ? input.perDayAddOns
    : Array.from({ length: dayCount }, () => input.addOns ?? []);

  const dayAddOnTotals = perDayAddOns.map((items) =>
    items.reduce((sum, i) => sum + i.price, 0),
  );
  const totalAddOns = dayAddOnTotals.reduce((sum, n) => sum + n, 0);

  const multi = dayCount > 1;

  // ── Base fee for ONE day ──
  let dailyBase: number;
  if (input.serviceType === "Dog Sitting") {
    const weight = toWeight(input.petWeight);
    const heavyDog = weight >= DOG_HEAVY_WEIGHT_KG;
    dailyBase = heavyDog ? PRICES.dogHeavy : PRICES.dogStandard;
    notes.push(
      heavyDog
        ? `基本 $${PRICES.dogHeavy}（狗狗體重 ${weight}kg ≥ ${DOG_HEAVY_WEIGHT_KG}kg）`
        : `基本 $${PRICES.dogStandard}（狗狗體重 < ${DOG_HEAVY_WEIGHT_KG}kg）`,
    );
  } else {
    const base =
      input.serviceType === "Cat Sitting (Express)"
        ? PRICES.catExpress
        : PRICES.catStandard;
    const catCount = clampCatCount(input.catCount);
    const extraCats = Math.max(0, catCount - CATS_INCLUDED_IN_BASE);
    const extraFee = extraCats * EXTRA_CAT_FEE;
    dailyBase = base + extraFee;
    notes.push(`基本 $${base}（最多 ${CATS_INCLUDED_IN_BASE} 隻貓）`);
    if (extraCats > 0) {
      notes.push(`額外 ${extraCats} 隻貓 × $${EXTRA_CAT_FEE} = $${extraFee}`);
    }
  }
  if (multi) notes.push(`基本服務費 × ${dayCount} 天`);

  // ── Add-ons, listed per day so the breakdown matches what is billed ──
  perDayAddOns.forEach((items, dayIdx) => {
    if (items.length === 0) return;
    notes.push(`第 ${dayIdx + 1} 天附加服務`);
    for (const item of items) notes.push(`${item.name} +$${item.price}`);
  });

  for (const item of surcharges) notes.push(`${item.name} +$${item.price}`);

  const base = dailyBase * dayCount;
  const total = base + totalAddOns + surchargesTotal;

  return {
    total,
    notes,
    extraCats:
      input.serviceType === "Dog Sitting"
        ? 0
        : Math.max(
            0,
            clampCatCount(input.catCount) - CATS_INCLUDED_IN_BASE,
          ),
    heavyDog:
      input.serviceType === "Dog Sitting" &&
      toWeight(input.petWeight) >= DOG_HEAVY_WEIGHT_KG,
    base,
    addOnsTotal: totalAddOns,
    surchargesTotal,
    dayCount,
    dailyBase,
    dailyAddOns: perDayAddOns[0]?.reduce((s, i) => s + i.price, 0) ?? 0,
    totalAddOns,
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
  { name: "剪指甲 Nail-cutting", price: ["+$30"] },
  { name: "清潔耳朵 Ear-cleaning", price: ["+$30"] },
  { name: "餵藥 Pill-feeding", price: ["+$30（1–5 粒）", "+$50（6–10 粒）", "+$100（11+ 粒）"] },
  { name: "注射 Injection", price: ["+$50"] },
  { name: "皮下輸液 Subcutaneous fluid injection", price: ["+$100"] },
];

export const SURCHARGES: AddOnRow[] = [
  { name: "緊急預約 Rush appointment（3天前預約）", price: ["+$30 / 次 起"] },
  { name: "非標準時段 Out of regular timeframe（09:00 前 / 21:00 後）", price: ["+$50 / 次 起"] },
];
