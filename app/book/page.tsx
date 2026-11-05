"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Stepper, type StepperStep } from "@/components/Stepper";
import { Modal } from "@/components/Modal";
import { apiGet, apiPost, ApiError } from "@/components/lib/api";
import { toIso } from "@/components/lib/format";
import type { AddressRecord, Pet } from "@/types";
import {
  ADD_ON_DEFS,
  addMinutes,
  addOnPrice,
  buildAddOns,
  buildSurchargesForDays,
  calcPrice,
  MAX_CATS,
  PILL_TIERS,
  type BookingLineItem,
  type PillTierId,
  type SelectedAddOns,
  SERVICE_META,
  SERVICE_TYPES,
  type ServiceType,
} from "@/components/lib/pricing";

const STEPS: StepperStep[] = [
  { id: 1, label: "服務及時間" },
  { id: 2, label: "聯絡資料" },
  { id: 3, label: "寵物資料" },
  { id: 4, label: "確認預約" },
];

/** Quick-select presets — set the start time only (end is auto-computed). */
const TIME_PRESETS = [
  { id: "morning", label: "上午", sub: "Morning", start: "09:00" },
  { id: "afternoon", label: "下午", sub: "Afternoon", start: "13:00" },
  { id: "evening", label: "晚上", sub: "Evening", start: "18:00" },
] as const;

type SlotId = (typeof TIME_PRESETS)[number]["id"];

interface ExtraDay {
  /** Stable key for React lists. */
  key: string;
  date: string;
  /** "" means no specific time (whole day). */
  slot: SlotId | "";
}

interface WizardState {
  serviceType: ServiceType;
  date: string;
  startTime: string; // HH:mm
  /**
   * Extra days for a multi-day booking. The primary `date` above is always
   * day 1; these are additional visits. Each carries its own optional slot.
   */
  extraDays: ExtraDay[];
  // NOTE: no endTime — it is derived from startTime + service duration.
  address: string;
  /** Region (地區), e.g. "九龍". Combined with `estate` into fullAddress. */
  region: string;
  /** Estate / building name (屋苑/大廈名稱). */
  estate: string;
  // Contact — guestData when signed out, auto-filled when signed in.
  guestTitle: "" | "先生" | "女士";
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  petName: string;
  petBreed: string;
  petWeight: string;
  catCount: number;
  vaccinated: boolean;
  sterilized: boolean;
  contagious: boolean;
  appearance: string;
  petNotes: string;
  agreed: boolean;
  /** Add-on selections; surcharges are derived, never stored here. */
  addOns: SelectedAddOns;
  /** Pill count tier for the pill-feeding add-on. */
  pillTier: PillTierId;
}

const INITIAL_STATE: WizardState = {
  serviceType: "Cat Sitting (Standard)",
  date: "",
  startTime: "09:00",
  extraDays: [],
  address: "",
  region: "",
  estate: "",
  guestTitle: "",
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  petName: "",
  petBreed: "",
  petWeight: "",
  catCount: 1,
  vaccinated: false,
  sterilized: false,
  contagious: false,
  appearance: "",
  petNotes: "",
  agreed: false,
  addOns: {},
  pillTier: "1-5",
};

const isCatService = (s: ServiceType) => SERVICE_META[s].petType === "cat";

/** Chinese label for a pet type, used in the saved-pet selector fallback. */
function petTypeLabel(type: string): string {
  if (type === "dog") return "狗狗";
  if (type === "cat") return "貓貓";
  return "其他";
}

/** Subset of GET /api/auth/session we rely on. */
interface SessionInfo {
  user?: { email?: string | null } | null;
}

/** Email must contain an @ and a dot in the domain; phone must be 8 digits. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\d{8}$/;

/** Weight bounds accepted for a dog booking, in kg. */
const DOG_WEIGHT_MIN = 5;
const DOG_WEIGHT_MAX = 80;

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // undefined = still resolving, null = guest, string = signed in.
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  // Saved profiles for signed-in users (empty for guests).
  const [savedAddresses, setSavedAddresses] = useState<AddressRecord[]>([]);
  const [savedPets, setSavedPets] = useState<Pet[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  // Resolve the session client-side so the page itself stays prerenderable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await apiGet<SessionInfo>("/api/auth/session");
        if (!cancelled) setEmail(session?.user?.email ?? null);
      } catch {
        if (!cancelled) setEmail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-fill the email once we know who they are.
  useEffect(() => {
    if (email) setState((prev) => ({ ...prev, guestEmail: email }));
  }, [email]);

  /**
   * Signed-in users pick from saved addresses/pets instead of retyping.
   * Failed fetches degrade silently to the manual form.
   */
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      const [addr, pets] = await Promise.allSettled([
        apiGet<{ addresses: AddressRecord[] }>("/api/addresses"),
        apiGet<{ pets: Pet[] }>("/api/pets"),
      ]);
      if (cancelled) return;
      if (addr.status === "fulfilled") {
        setSavedAddresses(addr.value.addresses ?? []);
      }
      if (pets.status === "fulfilled") setSavedPets(pets.value.pets ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  /** Selecting a saved address fills the address fields. */
  const selectAddress = (id: string) => {
    setSelectedAddressId(id);
    const found = savedAddresses.find((a) => a.id === id);
    if (!found) return;
    // Saved addresses store one combined string; keep it in `address` and
    // leave region/estate blank so the user can refine them if they wish.
    setState((prev) => ({
      ...prev,
      address: found.fullAddress,
    }));
  };

  /** Selecting a saved pet fills the pet fields known to the API. */
  const selectPet = (id: string) => {
    setSelectedPetId(id);
    const found = savedPets.find((p) => p.id === id);
    if (!found) return;
    setState((prev) => ({
      ...prev,
      petName: found.name,
      petBreed: found.breed ?? "",
      petWeight: found.weightKg != null ? String(found.weightKg) : "",
      vaccinated: found.vaccinated ?? false,
      sterilized: found.sterilized ?? false,
      contagious: found.contagious ?? false,
      appearance: found.appearance ?? "",
      petNotes: found.notes ?? "",
    }));
  };

  const isGuest = email === null;
  const sessionResolved = email !== undefined;

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Pet type follows the selected service (dog job ≠ cat job). A saved pet
  // may no longer match the new service type, so drop the selection.
  const updateServiceType = (serviceType: ServiceType) => {
    setState((prev) => ({ ...prev, serviceType }));
    setSelectedPetId(null);
  };

  /**
   * End time is not user-editable — it is derived from the start time plus
   * the service's slot length (auto-computed). Recomputed on every render so
   * it stays correct when either the start time or service changes.
   */
  const endTime = addMinutes(
    state.startTime,
    SERVICE_META[state.serviceType].durationMinutes,
  );

  // Add-ons are user-selected; surcharges are always derived from date/time.
  const addOns = buildAddOns(state.addOns, state.pillTier);

  // Multi-day: day 1 plus any extra dated rows. Days without a date are
  // ignored (the user may have added a row and not filled it in yet).
  const extraDaysFilled = state.extraDays.filter((d) => d.date.trim());
  const dayCount = 1 + extraDaysFilled.length;
  const billableDays = [
    { date: state.date, startTime: state.startTime },
    ...extraDaysFilled.map((d) => ({
      date: d.date,
      startTime: TIME_PRESETS.find((p) => p.id === d.slot)?.start ?? null,
    })),
  ];
  const surcharges = buildSurchargesForDays(billableDays);
  const breakdown = calcPrice({
    serviceType: state.serviceType,
    petWeight: state.petWeight,
    catCount: state.catCount,
    addOns,
    surcharges,
    dayCount,
  });
  const total = breakdown.total;

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return Boolean(state.date && state.startTime);
      case 2:
        return Boolean(
          (state.region.trim() || state.estate.trim() || state.address.trim()) &&
            (!isGuest ||
              (state.guestTitle !== "" &&
                state.guestName.trim() !== "" &&
                EMAIL_RE.test(state.guestEmail.trim()) &&
                PHONE_RE.test(state.guestPhone.trim()))),
        );
      case 3:
        return Boolean(state.petName.trim());
      case 4:
        // Pet + address are created inline by POST /api/bookings, so there is
        // nothing to wait for any more.
        return state.agreed;
      default:
        return true;
    }
  };

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  /**
   * Clear the wizard after a successful booking. Without this, revisiting
   * /book (e.g. via "New Booking") re-mounts the page with `successId` still
   * set and the success modal reappears.
   */
  const resetWizard = () => {
    setState(INITIAL_STATE);
    setStep(1);
    setSuccessId(null);
    setSubmitError(null);
    setSubmitting(false);
  };

  /** One request: creates pet + address + booking (+ guest user if needed). */
  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const start = toIso(state.date, state.startTime);
      const end = toIso(state.date, endTime);
      if (!start || !end) throw new ApiError("請選擇有效的日期及時間。", 400);
      if (new Date(end) <= new Date(start))
        throw new ApiError("結束時間必須晚於開始時間。", 400);

      const weight = state.petWeight ? Number(state.petWeight) : null;
      // HTML min/max don't stop programmatic/typed values, so clamp here.
      // Out-of-range input is rejected rather than silently altered.
      if (weight !== null) {
        if (
          !Number.isFinite(weight) ||
          weight < DOG_WEIGHT_MIN ||
          weight > DOG_WEIGHT_MAX
        ) {
          throw new ApiError(
            `狗狗體重必須介乎 ${DOG_WEIGHT_MIN}–${DOG_WEIGHT_MAX} kg。`,
            400,
          );
        }
      }

      const payload: Record<string, unknown> = {
        serviceType: state.serviceType,
        startTime: start,
        endTime: end,
        // Multi-day: day 1 is the primary date, extras follow. Each carries
        // an optional slot; "" means the day has no fixed time.
        ...(state.extraDays.some((d) => d.date.trim())
          ? {
              days: [
                { date: state.date, startTime: start, endTime: end },
                ...state.extraDays
                  .filter((d) => d.date.trim())
                  .map((d) => {
                    const preset = TIME_PRESETS.find((p) => p.id === d.slot);
                    if (!preset) return { date: d.date };
                    const s = toIso(d.date, preset.start);
                    const e = s
                      ? toIso(
                          d.date,
                          addMinutes(
                            preset.start,
                            SERVICE_META[state.serviceType].durationMinutes,
                          ),
                        )
                      : null;
                    return { date: d.date, startTime: s, endTime: e };
                  }),
              ],
            }
          : {}),
        totalHkd: total,
        // Line items must sum to totalHkd, or the stored booking disagrees
        // with itself. Add-ons are charged per visit, so their price is
        // multiplied here (Nail-cutting ×3 days → price 90, name suffixed).
        addOns: addOns.map((item) =>
          dayCount > 1
            ? {
                ...item,
                name: `${item.name}（${dayCount} 天）`,
                price: item.price * dayCount,
              }
            : item,
        ),
        // Surcharges arrive already totalled across days, so their prices
        // are already correct; pass through unchanged.
        surcharges,
        addressData: {
          // Region + estate combine into one address string, e.g.
          // "九龍, 淘大花園". Saved addresses fall back to the stored fullAddress.
          fullAddress:
            [state.region.trim(), state.estate.trim()]
              .filter(Boolean)
              .join(", ") || state.address.trim(),
          label: null,
        },
        petData: {
          name: state.petName.trim(),
          type: SERVICE_META[state.serviceType].petType,
          // Saved pet (signed-in only): link the exact row and let the backend
          // use its stored type, so a saved "other" pet isn't coerced.
          ...(selectedPetId ? { petId: selectedPetId } : {}),
          breed: state.petBreed.trim() || null,
          weightKg: weight !== null && Number.isFinite(weight) ? weight : null,
          vaccinated: state.vaccinated,
          sterilized: state.sterilized,
          contagious: state.contagious,
          appearance: state.appearance.trim() || null,
          notes: state.petNotes.trim() || null,
        },
      };

      // Only guests send contact details; signed-in users are resolved
      // server-side from their session.
      if (isGuest) {
        payload.guestData = {
          // The API has no title column; fold it into the stored name.
          name: `${state.guestTitle} ${state.guestName.trim()}`.trim(),
          email: state.guestEmail.trim(),
          phone: state.guestPhone.trim(),
        };
      }

      const { booking } = await apiPost<{ booking: { id: string } }>(
        "/api/bookings",
        payload,
      );
      setSuccessId(booking.id);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "提交預約失敗，請重試。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text sm:text-3xl">
          預約寵物保姆
        </h1>
        <p className="mt-1 text-sm text-text/70">
          只需四個步驟，即可完成預約。
        </p>
      </div>

      <div className="mb-8 rounded-2xl bg-white px-4 py-5 ring-1 ring-black/5 sm:px-6">
        <Stepper steps={STEPS} current={step} />
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-8">
        {step === 1 && (
          <StepOne
            state={state}
            onChange={update}
            onServiceChange={updateServiceType}
            total={total}
            priceNotes={breakdown.notes}
            surcharges={surcharges}
          />
        )}
        {step === 2 && (
          <StepTwo
            state={state}
            onChange={update}
            isGuest={isGuest}
            sessionResolved={sessionResolved}
            sessionEmail={email || ""}
            savedAddresses={savedAddresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={selectAddress}
          />
        )}
        {step === 3 && (
          <StepThree
            state={state}
            onChange={update}
            isGuest={isGuest}
            savedPets={savedPets}
            selectedPetId={selectedPetId}
            onSelectPet={selectPet}
          />
        )}
        {step === 4 && (
          <StepFour
            state={state}
            isGuest={isGuest}
            total={total}
            priceNotes={breakdown.notes}
            base={breakdown.base}
            dailyBase={breakdown.dailyBase}
            dayCount={breakdown.dayCount}
            addOns={addOns}
            surcharges={surcharges}
            onAgree={(v) => update("agreed", v)}
          />
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-text ring-1 ring-black/10 transition-colors hover:bg-white/70"
            >
              上一步
            </button>
          ) : (
            <Link
              href="/"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-text ring-1 ring-black/10 transition-colors hover:bg-white/70"
            >
              返回首頁
            </Link>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canProceed()}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一步
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canProceed() || submitting}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "提交中⋯" : "提交預約"}
            </button>
          )}
        </div>

        {submitError && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {submitError}
          </p>
        )}
      </div>

      {successId && (
        <Modal
          open
          title="預約已提交"
          onClose={() => setSuccessId(null)}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-4xl" aria-hidden>
              ✅
            </p>
            <p className="text-sm text-text/80">
              你嘅預約已提交，保姆確認後即可付款。
            </p>
            {isGuest && (
              <p className="text-xs text-text/70">
                登入連結已發送至 {state.guestEmail.trim()}
                ，登入後即可管理預約及上載疫苗證明。
              </p>
            )}
            <p className="text-xs text-text/60">
              預約編號：{successId.slice(0, 8)}
            </p>
            <Link
              href="/dashboard"
              onClick={resetWizard}
              className="mt-2 w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              前往我的預約
            </Link>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ─────────────────────────── Step 1 ─────────────────────────── */

function StepOne({
  state,
  onChange,
  onServiceChange,
  total,
  priceNotes,
  surcharges,
}: {
  state: WizardState;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onServiceChange: (serviceType: ServiceType) => void;
  total: number;
  priceNotes: string[];
  surcharges: BookingLineItem[];
}) {
  // Compute today only after mount to avoid prerender-time `new Date()`.
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const addExtraDay = () =>
    onChange("extraDays", [
      ...state.extraDays,
      {
        key:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : String(Date.now() + Math.random()),
        date: "",
        slot: "",
      },
    ]);

  const removeExtraDay = (key: string) =>
    onChange(
      "extraDays",
      state.extraDays.filter((d) => d.key !== key),
    );

  const updateExtraDay = (key: string, patch: Partial<ExtraDay>) =>
    onChange(
      "extraDays",
      state.extraDays.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );

  const catService = isCatService(state.serviceType);
  // Derived, never typed: start time + the service's slot length.
  const estimatedEnd = addMinutes(
    state.startTime,
    SERVICE_META[state.serviceType].durationMinutes,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Service selection (distinct golden background) ── */}
      <section className="rounded-2xl bg-card p-4 ring-1 ring-black/5 sm:p-5">
        <h2 className="text-lg font-semibold text-text">選擇服務類型</h2>
        <p className="mt-1 text-xs text-text/70">
          收費按服務類型計算，詳情請參閱首頁價目表。
        </p>

        <div className="mt-4 grid gap-3" role="radiogroup" aria-label="服務類型">
          {SERVICE_TYPES.map((value) => {
            const meta = SERVICE_META[value];
            const active = state.serviceType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onServiceChange(value)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                  active
                    ? "bg-primary text-white ring-2 ring-text/20"
                    : "bg-white text-text ring-1 ring-black/5 hover:bg-white/80"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {meta.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {meta.label}
                    <span className="ml-1 text-xs font-normal opacity-70">
                      {meta.subtitle}
                    </span>
                  </span>
                  <span className="text-xs opacity-70">
                    每次約 {meta.duration}
                  </span>
                </span>
                <span
                  className={`ml-auto text-sm font-bold ${
                    active ? "text-white" : "text-primary"
                  }`}
                >
                  {value === "Dog Sitting"
                    ? "由 $250"
                    : value === "Cat Sitting (Express)"
                      ? "由 $200"
                      : "由 $250"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cat quantity — only for cat services */}
        {catService && (
          <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-black/5">
            <label
              htmlFor="cat-count"
              className="block text-sm font-semibold text-text"
            >
              貓隻數量 (Number of Cats)
            </label>
            <p className="mt-1 text-xs text-text/60">
              基本收費已包括 2 隻貓，每多 1 隻加 $20（最多 {MAX_CATS} 隻）。
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                aria-label="減少貓隻數量"
                onClick={() => onChange("catCount", Math.max(1, state.catCount - 1))}
                disabled={state.catCount <= 1}
                className="h-10 w-10 rounded-lg bg-bg text-lg font-bold text-text transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <input
                id="cat-count"
                type="number"
                min={1}
                max={MAX_CATS}
                value={state.catCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange(
                    "catCount",
                    Number.isFinite(n) && n >= 1
                      ? Math.min(MAX_CATS, Math.floor(n))
                      : 1,
                  );
                }}
                className="w-20 rounded-lg border border-black/10 bg-surface px-3 py-2 text-center text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                aria-label="增加貓隻數量"
                onClick={() =>
                  onChange("catCount", Math.min(MAX_CATS, state.catCount + 1))
                }
                disabled={state.catCount >= MAX_CATS}
                className="h-10 w-10 rounded-lg bg-bg text-lg font-bold text-text transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
              <span className="text-xs text-text/60">
                共 {state.catCount} 隻
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Date & time ── */}
      <h2 className="text-lg font-semibold text-text">選擇日期及時間</h2>

      <div>
        <label htmlFor="booking-date" className="mb-2 block text-sm font-medium text-text">
          日期
        </label>
        <input
          id="booking-date"
          type="date"
          min={today}
          value={state.date}
          onChange={(e) => onChange("date", e.target.value)}
          className={inputClass}
        />
      </div>

        {/* Additional days (multi-day booking) */}
        {state.extraDays.length > 0 && (
        <div className="flex flex-col gap-2">
          {state.extraDays.map((day, idx) => (
            <div
              key={day.key}
              className="flex flex-wrap items-end gap-2 rounded-xl bg-surface p-3 ring-1 ring-black/5"
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`extra-day-${day.key}`}
                  className="mb-1 block text-xs font-medium text-text/70"
                >
                  第 {idx + 2} 天
                </label>
                <input
                  id={`extra-day-${day.key}`}
                  type="date"
                  min={today}
                  value={day.date}
                  onChange={(e) => updateExtraDay(day.key, { date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`extra-slot-${day.key}`}
                  className="mb-1 block text-xs font-medium text-text/70"
                >
                  時段（選填）
                </label>
                <select
                  id={`extra-slot-${day.key}`}
                  value={day.slot}
                  onChange={(e) =>
                    updateExtraDay(day.key, { slot: e.target.value as SlotId | "" })
                  }
                  className={inputClass}
                >
                  <option value="">全日 / 待定</option>
                  {TIME_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} {p.sub}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeExtraDay(day.key)}
                aria-label={`移除第 ${idx + 2} 天`}
                className="rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50"
              >
                移除
              </button>
            </div>
          ))}
        </div>
        )}

        <button
        type="button"
        onClick={addExtraDay}
        className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-text ring-1 ring-black/10 hover:bg-black/5"
        >
        + 新增另一天
        </button>

      {/* Quick-select time presets */}
      <div>
        <span className="mb-2 block text-sm font-medium text-text">
          快速選擇時段
        </span>
        <div className="grid grid-cols-3 gap-2">
          {TIME_PRESETS.map((preset) => {
            const active = state.startTime === preset.start;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange("startTime", preset.start)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "bg-bg text-text ring-1 ring-black/5 hover:bg-card"
                }`}
              >
                <span>{preset.label}</span>
                <span
                  className={`text-[10px] font-normal ${
                    active ? "text-white/80" : "text-text/60"
                  }`}
                >
                  {preset.sub} · 由 {preset.start}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start-time" className="mb-2 block text-sm font-medium text-text">
            或 輸入開始時間
          </label>
          <input
            id="start-time"
            type="time"
            value={state.startTime}
            onChange={(e) => onChange("startTime", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="end-time" className="mb-2 block text-sm font-medium text-text">
            預計結束時間
          </label>
          {/* Derived from start time + service duration; not user-editable. */}
          <input
            id="end-time"
            type="text"
            value={estimatedEnd}
            readOnly
            disabled
            aria-describedby="end-time-hint"
            className={`${inputClass} cursor-not-allowed bg-black/5 text-text/70`}
          />
          <p id="end-time-hint" className="mt-1 text-xs text-text/60">
            {SERVICE_META[state.serviceType].label} 約需{" "}
            {SERVICE_META[state.serviceType].duration}，系統自動計算。
          </p>
        </div>
      </div>

      {/* Surcharges are derived from date/time — never user-toggled. */}
      {surcharges.length > 0 && (
        <div className="flex flex-col gap-2">
          {surcharges.map((s) => (
            <div
              key={s.id}
              role="status"
              className="rounded-r-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800"
            >
              {s.id === "rushAppointment" ? (
                <p>
                  <span className="font-semibold">加急預約：</span>
                  所選日期少於 3 日，將額外收取 ${s.price} 起加急費。
                </p>
              ) : (
                <p>
                  <span className="font-semibold">非服務時間：</span>
                  所選開始時間不在 09:00–21:00 之內，將額外收取 ${s.price}{" "}
                  起附加費。
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <PriceSummary total={total} notes={priceNotes} />
    </div>
  );
}

/* ─────────────────────────── Step 2 ─────────────────────────── */

function StepTwo({
  state,
  onChange,
  isGuest,
  sessionResolved,
  sessionEmail,
  savedAddresses,
  selectedAddressId,
  onSelectAddress,
}: {
  state: WizardState;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isGuest: boolean;
  sessionResolved: boolean;
  sessionEmail: string;
  savedAddresses: AddressRecord[];
  selectedAddressId: string | null;
  onSelectAddress: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-text">聯絡資料及地址</h2>

      {/* Contact ------------------------------------------------------------ */}
      {!sessionResolved ? (
        <p className="text-xs text-text/60">正在確認登入狀態⋯</p>
      ) : isGuest ? (
        <div className="flex flex-col gap-4 rounded-xl bg-surface p-4 ring-1 ring-black/5">
          <div>
            <h3 className="text-sm font-semibold text-text">聯絡人</h3>
            <p className="mt-0.5 text-xs text-text/60">
              完成預約後，系統會寄出登入連結至你的電郵。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
          
            <Field label="姓名" htmlFor="guest-name">
              <input
                id="guest-name"
                type="text"
                value={state.guestName}
                onChange={(e) => onChange("guestName", e.target.value)}
                placeholder="例如：陳小明"
                className={inputClass}
              />
            </Field>

            <Field label="稱謂" htmlFor="guest-title">
              <select
                id="guest-title"
                value={state.guestTitle}
                onChange={(e) =>
                  onChange(
                    "guestTitle",
                    e.target.value as WizardState["guestTitle"],
                  )
                }
                className={inputClass}
              >
                <option value="">請選擇</option>
                <option value="先生">先生</option>
                <option value="女士">女士</option>
              </select>
            </Field>
          </div>

          <Field label="電郵 Email" htmlFor="guest-email">
            <input
              id="guest-email"
              type="email"
              inputMode="email"
              value={state.guestEmail}
              onChange={(e) => onChange("guestEmail", e.target.value)}
              placeholder="you@example.com"
              aria-invalid={
                state.guestEmail.trim() !== "" &&
                !EMAIL_RE.test(state.guestEmail.trim())
              }
              className={inputClass}
            />
            {state.guestEmail.trim() !== "" &&
              !EMAIL_RE.test(state.guestEmail.trim()) && (
                <p role="alert" className="mt-1 text-xs text-red-700">
                  請輸入有效的電郵地址（需包含 @ 及 .）。
                </p>
              )}
          </Field>

          <Field label="聯絡電話" htmlFor="guest-phone">
            <input
              id="guest-phone"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              value={state.guestPhone}
              onChange={(e) =>
                onChange("guestPhone", e.target.value.replace(/\D/g, ""))
              }
              placeholder="8 位數字，例如 91234567"
              aria-invalid={
                state.guestPhone.trim() !== "" &&
                !PHONE_RE.test(state.guestPhone.trim())
              }
              className={inputClass}
            />
            {state.guestPhone.trim() !== "" &&
              !PHONE_RE.test(state.guestPhone.trim()) && (
                <p role="alert" className="mt-1 text-xs text-red-700">
                  請輸入 8 位數字電話號碼。
                </p>
              )}
          </Field>
        </div>
      ) : (
        <div className="rounded-xl bg-card/40 px-4 py-3 text-sm text-text">
          登入帳戶：<strong>{sessionEmail}</strong>
        </div>
      )}

      {/* Saved addresses (signed-in only) -------------------------------- */}
      {!isGuest && savedAddresses.length > 0 && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-black/5">
          <h3 className="text-sm font-semibold text-text">選擇已儲存地址</h3>
          <p className="mt-0.5 text-xs text-text/60">
            選擇後會自動填入下方欄位，仍可自行修改。
          </p>
          <div className="mt-3 grid gap-2">
            {savedAddresses.map((addr) => {
              const active = selectedAddressId === addr.id;
              return (
                <button
                  key={addr.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectAddress(addr.id)}
                  className={`rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "bg-white text-text ring-1 ring-black/5 hover:bg-white/80"
                  }`}
                >
                  <span className="block font-medium">
                    {addr.label || addr.fullAddress}
                  </span>
                  {addr.label && (
                    <span className="block text-xs opacity-70">
                      {addr.fullAddress}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Address — region + estate; door codes are no longer collected. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="地區" htmlFor="address-region">
          <input
            id="address-region"
            type="text"
            value={state.region}
            onChange={(e) => onChange("region", e.target.value)}
            placeholder="九龍 / 香港島 / 新界"
            className={inputClass}
          />
        </Field>
        <Field label="屋苑／大廈名稱" htmlFor="address-estate">
          <input
            id="address-estate"
            type="text"
            value={state.estate}
            onChange={(e) => onChange("estate", e.target.value)}
            placeholder="淘大花園"
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

/* ─────────────────────────── Step 3 ─────────────────────────── */

function StepThree({
  state,
  onChange,
  isGuest,
  savedPets,
  selectedPetId,
  onSelectPet,
}: {
  state: WizardState;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isGuest: boolean;
  savedPets: Pet[];
  selectedPetId: string | null;
  onSelectPet: (id: string) => void;
}) {
  const serviceMeta = SERVICE_META[state.serviceType];
  const petLabel = serviceMeta.petType === "dog" ? "狗狗" : "貓貓";
  // A dog service shouldn't offer saved cats (and vice versa).
  const matchingPets = savedPets.filter(
    (p) => p.type === serviceMeta.petType || p.type === "other",
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-card/40 px-4 py-3 text-xs text-text">
        已選擇服務：<strong>{serviceMeta.label}</strong>（{serviceMeta.subtitle}）
        {isCatService(state.serviceType) && state.catCount > 1 && (
          <span className="ml-1">· 共 {state.catCount} 隻貓</span>
        )}
      </div>

      <h2 className="text-lg font-semibold text-text">寵物資料</h2>

      {/* Saved pets (signed-in only), filtered to the service's pet type. */}
      {!isGuest && matchingPets.length > 0 && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-black/5">
          <h3 className="text-sm font-semibold text-text">選擇已儲存寵物</h3>
          <p className="mt-0.5 text-xs text-text/60">
            選擇後會自動填入下方資料，仍可自行修改。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {matchingPets.map((pet) => {
              const active = selectedPetId === pet.id;
              return (
                <button
                  key={pet.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectPet(pet.id)}
                  className={`rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "bg-white text-text ring-1 ring-black/5 hover:bg-white/80"
                  }`}
                >
                  <span className="block font-medium">{pet.name}</span>
                  <span className="block text-xs opacity-70">
                    {[pet.breed, pet.weightKg ? `${pet.weightKg} kg` : null]
                      .filter(Boolean)
                      .join(" · ") || petTypeLabel(pet.type)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

            <Field label="寵物名稱（可填寫多隻）" htmlFor="pet-name">
        <input
          id="pet-name"
          type="text"
          value={state.petName}
          onChange={(e) => onChange("petName", e.target.value)}
          placeholder={
            serviceMeta.petType === "dog"
              ? "例如：旺財 & 阿福"
              : "例如：Mimi & Momo"
          }
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="品種（選填）" htmlFor="pet-breed">
          <input
            id="pet-breed"
            type="text"
            value={state.petBreed}
            onChange={(e) => onChange("petBreed", e.target.value)}
            placeholder={
              serviceMeta.petType === "dog" ? "例如：柴犬" : "例如：英國短毛貓"
            }
            className={inputClass}
          />
        </Field>
        {/* Weight is only meaningful for dogs — it drives the price tier. */}
        {serviceMeta.petType === "dog" && (
          <Field label="體重 kg（選填）" htmlFor="pet-weight">
            <input
              id="pet-weight"
              type="number"
              step="0.1"
              min={DOG_WEIGHT_MIN}
              max={DOG_WEIGHT_MAX}
              value={state.petWeight}
              onChange={(e) => {
                const raw = e.target.value;
                // Reject a leading "-" outright; `min` alone still lets
                // negative values be typed in some browsers.
                if (raw.startsWith("-")) return;
                onChange("petWeight", raw);
              }}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (e.target.value === "" || !Number.isFinite(n)) return;
                // Snap an out-of-range entry back into the valid band.
                if (n < DOG_WEIGHT_MIN) onChange("petWeight", String(DOG_WEIGHT_MIN));
                else if (n > DOG_WEIGHT_MAX)
                  onChange("petWeight", String(DOG_WEIGHT_MAX));
              }}
              placeholder="例如：4.5"
              className={inputClass}
            />
            {state.petWeight !== "" &&
              (Number(state.petWeight) < DOG_WEIGHT_MIN ||
                Number(state.petWeight) > DOG_WEIGHT_MAX) && (
                <p role="alert" className="mt-1 text-xs text-red-700">
                  體重必須介乎 {DOG_WEIGHT_MIN}–{DOG_WEIGHT_MAX} kg。
                </p>
              )}
          </Field>
        )}
      </div>

      {serviceMeta.petType === "dog" && (
        <p className="rounded-lg bg-surface px-3 py-2 text-xs text-text/70">
          狗狗體重 ≥ 15kg 將按 $300 收費；如未填寫體重，暫以 $250 計算。
        </p>
      )}

      <Field label="外觀與性格（選填）" htmlFor="pet-appearance">
        <textarea
          id="pet-appearance"
          rows={3}
          value={state.appearance}
          onChange={(e) => onChange("appearance", e.target.value)}
          placeholder="例如：白色長毛、怕陌生人、喜歡躲在床下"
          className={inputClass}
        />
      </Field>

      {/* Health flags */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={state.vaccinated}
            onChange={(e) => onChange("vaccinated", e.target.checked)}
            className="h-5 w-5 rounded border-black/20 accent-primary"
          />
          已完成疫苗接種
        </label>
        <label className="flex items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={state.sterilized}
            onChange={(e) => onChange("sterilized", e.target.checked)}
            className="h-5 w-5 rounded border-black/20 accent-primary"
          />
          已絕育 (Sterilized)
        </label>
        <label className="flex items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={state.contagious}
            onChange={(e) => onChange("contagious", e.target.checked)}
            className="h-5 w-5 rounded border-black/20 accent-primary"
          />
          有傳染病 (Contagious)
        </label>
        {state.contagious && (
          <div
            role="alert"
            className="rounded-r-lg border-l-4 border-yellow-500 bg-yellow-100 p-4 text-sm text-yellow-700"
          >
            <p className="font-semibold">⚠️ 傳染病申報</p>
            <p className="mt-1">
              你已申報寵物有傳染病。請務必於備註詳細說明，以便保姆安排隔離、
              消毒及個人防護措施；如情況嚴重，保姆有權拒絕提供服務。
            </p>
          </div>
        )}
      </div>

      <Field label="其他注意事項（選填）" htmlFor="pet-notes">
        <textarea
          id="pet-notes"
          rows={3}
          value={state.petNotes}
          onChange={(e) => onChange("petNotes", e.target.value)}
          placeholder="飲食習慣、藥物、健康狀況等"
          className={inputClass}
        />
      </Field>

      {/* ── Add-ons ── */}
      <section className="rounded-xl bg-surface p-4 ring-1 ring-black/5">
        <h3 className="text-sm font-semibold text-text">
          附加服務 (每次上門計算 / Per Visit)
        </h3>
        <p className="mt-0.5 text-xs text-text/60">
          附加服務將按預約日數乘以收費。
        </p>
        <p className="mt-0.5 text-xs text-text/50">
          可選多項，費用即時計入總額。
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {ADD_ON_DEFS.map((def) => {
            const checked = Boolean(state.addOns[def.id]);
            const price = addOnPrice(def.id, state.pillTier);
            return (
              <div
                key={def.id}
                className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-black/5"
              >
                <label className="flex items-center gap-3 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      onChange("addOns", {
                        ...state.addOns,
                        [def.id]: e.target.checked,
                      })
                    }
                    className="h-5 w-5 rounded border-black/20 accent-primary"
                  />
                  <span className="flex-1">{def.label}</span>
                  <span className="text-sm font-semibold text-primary">
                    {def.price === null
                      ? `+$${price ?? PILL_TIERS[0].price}`
                      : `+$${def.price}`}
                  </span>
                </label>

                {/* Pill-feeding needs a quantity tier. */}
                {def.id === "pillFeeding" && checked && (
                  <div className="mt-2.5 flex items-center gap-2 border-t border-black/5 pt-2.5">
                    <label
                      htmlFor="pill-tier"
                      className="text-xs text-text/70"
                    >
                      藥丸數量
                    </label>
                    <select
                      id="pill-tier"
                      value={state.pillTier}
                      onChange={(e) =>
                        onChange("pillTier", e.target.value as PillTierId)
                      }
                      className="rounded-lg border border-black/10 bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      {PILL_TIERS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}（+${t.price}）
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Documents: no pet record exists until POST /api/bookings runs, so
          uploads happen from the dashboard afterwards. */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <p className="text-sm font-semibold">ℹ️ 文件上傳</p>
        {isGuest ? (
          <p className="mt-1 text-xs">
            完成預約後，你會收到登入連結，屆時可於「我的預約」上載疫苗接種證明等文件。
          </p>
        ) : (
          <p className="mt-1 text-xs">
            寵物檔案會於提交預約時一併建立。完成預約後，請前往「我的預約」上載寵物相片、疫苗接種證明及體重證明。
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Step 4 ─────────────────────────── */

function StepFour({
  state,
  isGuest,
  total,
  priceNotes,
  base,
  dailyBase,
  dayCount,
  addOns,
  surcharges,
  onAgree,
}: {
  state: WizardState;
  isGuest: boolean;
  total: number;
  priceNotes: string[];
  base: number;
  dailyBase: number;
  dayCount: number;
  addOns: BookingLineItem[];
  surcharges: BookingLineItem[];
  onAgree: (v: boolean) => void;
}) {
  const serviceMeta = SERVICE_META[state.serviceType];
  const rows: { label: string; value: string }[] = [
    {
      label: "服務",
      value: `${serviceMeta.label}（${serviceMeta.subtitle}）`,
    },
    ...(isCatService(state.serviceType)
      ? [{ label: "貓隻數量", value: `${state.catCount} 隻` }]
      : []),
    {
      label: "日期",
      value:
        state.extraDays.filter((d) => d.date.trim()).length > 0
          ? `${state.date}（共 ${
              1 + state.extraDays.filter((d) => d.date.trim()).length
            } 天，多日預約）`
          : state.date || "—",
    },
    {
      label: "時間",
      value: `${state.startTime} – ${addMinutes(
        state.startTime,
        serviceMeta.durationMinutes,
      )}`,
    },
    ...(state.extraDays.filter((d) => d.date.trim()).length > 0
      ? [
          {
            label: "其他日期",
            value: state.extraDays
              .filter((d) => d.date.trim())
              .map((d) => {
                const preset = TIME_PRESETS.find((p) => p.id === d.slot);
                return preset ? `${d.date} ${preset.label}` : `${d.date} 全日`;
              })
              .join("、"),
          },
        ]
      : []),
    {
      label: "地址",
      value:
        [state.region.trim(), state.estate.trim()].filter(Boolean).join(", ") ||
        state.address ||
        "—",
    },
    {
      label: "寵物",
      value: state.petName
        ? `${state.petName}${state.petBreed ? `（${state.petBreed}）` : ""}`
        : "—",
    },
    ...(isGuest
      ? [
          { label: "聯絡人", value: state.guestName || "—" },
          { label: "電話", value: state.guestPhone || "—" },
          { label: "電郵", value: state.guestEmail || "—" },
        ]
      : [{ label: "電郵", value: state.guestEmail || "—" }]),
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-text">確認預約詳情</h2>

      <dl className="divide-y divide-black/5 rounded-xl bg-surface px-4 py-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-3 gap-2 py-2.5 text-sm">
            <dt className="font-medium text-text/70">{row.label}</dt>
            <dd className="col-span-2 break-words text-text">{row.value}</dd>
          </div>
        ))}
      </dl>

      {/* Itemised: Base + Add-ons + Surcharges = Total */}
      <div className="rounded-xl bg-bg px-4 py-3 ring-1 ring-black/5">
        <dl className="space-y-1.5 text-sm text-text">
          <div className="flex justify-between">
            <dt>
              {dayCount > 1 ? `基本服務費（${dayCount} 天）` : "基本服務費"}
            </dt>
            <dd>
              {dayCount > 1 && (
                <span className="mr-2 text-xs text-text/50">
                  HK${dailyBase} × {dayCount}
                </span>
              )}
              HK${base}
            </dd>
          </div>
          {addOns.length > 0 && (
            <>
              <div className="pt-1 text-xs font-semibold text-text/60">
                {dayCount > 1 ? `附加服務（每次 × ${dayCount} 天）` : "附加服務"}
              </div>
              {addOns.map((item) => (
                <div key={item.id} className="flex justify-between pl-3">
                  <dt className="text-text/80">
                    {item.name}
                    {dayCount > 1 && (
                      <span className="ml-1 text-xs text-text/50">
                        × {dayCount}
                      </span>
                    )}
                  </dt>
                  <dd className="text-text/80">
                    HK${item.price * dayCount}
                  </dd>
                </div>
              ))}
            </>
          )}
          {surcharges.length > 0 && (
            <>
              <div className="pt-1 text-xs font-semibold text-text/60">
                附加費用（起）
              </div>
              {surcharges.map((item) => (
                <div key={item.id} className="flex justify-between pl-3">
                  <dt className="text-text/80">{item.name}</dt>
                  <dd className="text-text/80">HK${item.price} 起</dd>
                </div>
              ))}
            </>
          )}
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-black/10 pt-3">
          <span className="text-sm font-semibold text-text">參考總額</span>
          <span className="text-xl font-bold text-text">HK${total}</span>
        </div>
        <p className="mt-2 text-[11px] text-text/50">
          加急及非服務時間費用為起價，保姆確認實際情況後可能調整。
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-text">
        <input
          type="checkbox"
          checked={state.agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-black/20 accent-primary"
        />
        <span>
          我已閱讀並同意
          <Link href="/terms" className="font-semibold text-primary underline">
            服務條款
          </Link>
          及
          <Link href="/privacy" className="font-semibold text-primary underline">
            私隱政策
          </Link>
          。
        </span>
      </label>
    </div>
  );
}

/* ─────────────────────────── Shared bits ─────────────────────────── */

const inputClass =
  "w-full rounded-xl border border-black/10 bg-surface px-4 py-3 text-text outline-none placeholder:text-text/40 focus:border-primary focus:ring-2 focus:ring-primary/30";

function PriceSummary({ total, notes }: { total: number; notes: string[] }) {
  return (
    <div className="rounded-xl bg-bg px-4 py-3 ring-1 ring-black/5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-text">預計費用</span>
        <span className="text-xl font-bold text-text">HK${total}</span>
      </div>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {notes.map((n) => (
            <li key={n} className="text-xs text-text/65">
              · {n}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-text/50">
        以上為參考總額。加急及非服務時間費用為「起」價，保姆確認實際情況後可能調整。
      </p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-text">
        {label}
      </label>
      {children}
    </div>
  );
}
