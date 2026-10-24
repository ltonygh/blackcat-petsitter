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
  petType: "dog" | "cat";
}

export const SERVICE_META: Record<ServiceType, ServiceMeta> = {
  "Dog Sitting": {
    value: "Dog Sitting",
    label: "狗狗保姆",
    subtitle: "Dog Sitting",
    icon: "\u{1F415}",
    duration: "45–60 分鐘",
    petType: "dog",
  },
  "Cat Sitting (Standard)": {
    value: "Cat Sitting (Standard)",
    label: "貓貓保姆（標準）",
    subtitle: "Cat Sitting (Standard)",
    icon: "\u{1F408}",
    duration: "45–60 分鐘",
    petType: "cat",
  },
  "Cat Sitting (Express)": {
    value: "Cat Sitting (Express)",
    label: "貓貓保姆（特快）",
    subtitle: "Cat Sitting (Express)",
    icon: "\u{26A1}",
    duration: "15–20 分鐘",
    petType: "cat",
  },
};

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
}

export interface PriceBreakdown {
  total: number;
  /** Human readable explanation, e.g. "基本 $250 + 額外 1 隻貓 $20". */
  notes: string[];
  /** Extra cats beyond the 2 included in the base fee. */
  extraCats: number;
  /** true when a dog's weight pushed it into the $300 band. */
  heavyDog: boolean;
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

  if (input.serviceType === "Dog Sitting") {
    const weight = toWeight(input.petWeight);
    const heavyDog = weight >= DOG_HEAVY_WEIGHT_KG;
    if (heavyDog) {
      notes.push(
        `基本 $${PRICES.dogHeavy}（狗狗體重 ${weight}kg ≥ ${DOG_HEAVY_WEIGHT_KG}kg）`,
      );
    } else {
      notes.push(`基本 $${PRICES.dogStandard}（狗狗體重 < ${DOG_HEAVY_WEIGHT_KG}kg）`);
    }
    return {
      total: heavyDog ? PRICES.dogHeavy : PRICES.dogStandard,
      notes,
      extraCats: 0,
      heavyDog,
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

  return {
    total: base + extraFee,
    notes,
    extraCats,
    heavyDog: false,
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
  {
    task: "清潔寵物用品及生活空間 Clean pet items and living space",
    values: ["yes", "yes", "yes"],
  },
  { task: "更換尿片 Change diapers", values: ["yes", "no", "no"] },
  { task: "處理排泄物 Waste disposal", values: ["yes", "yes", "yes"] },
  { task: "玩耍 / 梳洗 Playing / Grooming", values: ["yes", "yes", "no"] },
  { task: "散步 Walking", values: ["yes", "no", "no"] },
  { task: "視像通話 FaceTime", values: ["optional", "optional", "no"] },
];

export interface AddOnRow {
  name: string;
  price: string;
}

export const ADD_ONS: AddOnRow[] = [
  { name: "剪指甲 Nail-cutting", price: "+ $30" },
  { name: "清潔耳朵 Ear-cleaning", price: "+ $30" },
  { name: "餵藥 Pill-feeding", price: "+ $30（1–5 粒）／+ $50（6–10 粒）／+ $100（11+ 粒）" },
  { name: "注射 Injection", price: "+ $50" },
  { name: "皮下輸液 Subcutaneous fluid injection", price: "+ $100" },
  { name: "緊急預約 Rush appointment（< 3 日前預約）", price: "+ $30 / 次" },
  {
    name: "非標準時段 Out of regular timeframe（09:00 前 / 21:00 後）",
    price: "+ $50 / 次",
  },
];
