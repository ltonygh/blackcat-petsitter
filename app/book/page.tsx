"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Stepper, type StepperStep } from "@/components/Stepper";
import { Modal } from "@/components/Modal";
import { apiGet, apiPost, ApiError } from "@/components/lib/api";
import { toIso } from "@/components/lib/format";
import {
  calcPrice,
  MAX_CATS,
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

/** Quick-select presets that auto-fill the time inputs. */
const TIME_PRESETS = [
  { id: "morning", label: "上午", sub: "Morning", start: "09:00", end: "12:00" },
  { id: "afternoon", label: "下午", sub: "Afternoon", start: "13:00", end: "17:00" },
  { id: "evening", label: "晚上", sub: "Evening", start: "18:00", end: "21:00" },
] as const;

interface WizardState {
  serviceType: ServiceType;
  date: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  address: string;
  doorCode: string;
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
}

const INITIAL_STATE: WizardState = {
  serviceType: "Cat Sitting (Standard)",
  date: "",
  startTime: "09:00",
  endTime: "18:00",
  address: "",
  doorCode: "",
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
};

const isCatService = (s: ServiceType) => SERVICE_META[s].petType === "cat";

/** Subset of GET /api/auth/session we rely on. */
interface SessionInfo {
  user?: { email?: string | null } | null;
}

/** Email must contain an @ and a dot in the domain; phone must be 8 digits. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\d{8}$/;

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // undefined = still resolving, null = guest, string = signed in.
  const [email, setEmail] = useState<string | null | undefined>(undefined);

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

  const isGuest = email === null;
  const sessionResolved = email !== undefined;

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Pet type follows the selected service (dog job ≠ cat job).
  const updateServiceType = (serviceType: ServiceType) =>
    setState((prev) => ({ ...prev, serviceType }));

  const breakdown = calcPrice({
    serviceType: state.serviceType,
    petWeight: state.petWeight,
    catCount: state.catCount,
  });
  const total = breakdown.total;

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return Boolean(state.date && state.startTime && state.endTime);
      case 2:
        return Boolean(
          state.address.trim() &&
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
      const end = toIso(state.date, state.endTime);
      if (!start || !end) throw new ApiError("請選擇有效的日期及時間。", 400);
      if (new Date(end) <= new Date(start))
        throw new ApiError("結束時間必須晚於開始時間。", 400);

      const weight = state.petWeight ? Number(state.petWeight) : null;

      const payload: Record<string, unknown> = {
        serviceType: state.serviceType,
        startTime: start,
        endTime: end,
        totalHkd: total,
        addressData: {
          fullAddress: state.address.trim(),
          doorCode: state.doorCode.trim(),
          label: null,
        },
        petData: {
          name: state.petName.trim(),
          type: SERVICE_META[state.serviceType].petType,
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
        <h1 className="text-2xl font-bold text-[#4A3B32] sm:text-3xl">
          預約寵物保姆
        </h1>
        <p className="mt-1 text-sm text-[#4A3B32]/70">
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
          />
        )}
        {step === 2 && (
          <StepTwo
            state={state}
            onChange={update}
            isGuest={isGuest}
            sessionResolved={sessionResolved}
            sessionEmail={email || ""}
          />
        )}
        {step === 3 && (
          <StepThree state={state} onChange={update} isGuest={isGuest} />
        )}
        {step === 4 && (
          <StepFour
            state={state}
            isGuest={isGuest}
            total={total}
            priceNotes={breakdown.notes}
            onAgree={(v) => update("agreed", v)}
          />
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 transition-colors hover:bg-white/70"
            >
              上一步
            </button>
          ) : (
            <Link
              href="/"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 transition-colors hover:bg-white/70"
            >
              返回首頁
            </Link>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canProceed()}
              className="rounded-xl bg-[#FFA259] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一步
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canProceed() || submitting}
              className="rounded-xl bg-[#FFA259] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d] disabled:cursor-not-allowed disabled:opacity-40"
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
            <p className="text-sm text-[#4A3B32]/80">
              你嘅預約已提交，保姆確認後即可付款。
            </p>
            {isGuest && (
              <p className="text-xs text-[#4A3B32]/70">
                登入連結已發送至 {state.guestEmail.trim()}
                ，登入後即可管理預約及上載疫苗證明。
              </p>
            )}
            <p className="text-xs text-[#4A3B32]/60">
              預約編號：{successId.slice(0, 8)}
            </p>
            <Link
              href="/dashboard"
              onClick={resetWizard}
              className="mt-2 w-full rounded-xl bg-[#FFA259] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#ff8f3d]"
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
}: {
  state: WizardState;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onServiceChange: (serviceType: ServiceType) => void;
  total: number;
  priceNotes: string[];
}) {
  // Compute today only after mount to avoid prerender-time `new Date()`.
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const catService = isCatService(state.serviceType);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Service selection (distinct golden background) ── */}
      <section className="rounded-2xl bg-[#FFCB56] p-4 ring-1 ring-black/5 sm:p-5">
        <h2 className="text-lg font-semibold text-[#4A3B32]">選擇服務類型</h2>
        <p className="mt-1 text-xs text-[#4A3B32]/70">
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
                    ? "bg-[#FFA259] text-white ring-2 ring-[#4A3B32]/20"
                    : "bg-white text-[#4A3B32] ring-1 ring-black/5 hover:bg-white/80"
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
                    active ? "text-white" : "text-[#FFA259]"
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
              className="block text-sm font-semibold text-[#4A3B32]"
            >
              貓隻數量 (Number of Cats)
            </label>
            <p className="mt-1 text-xs text-[#4A3B32]/60">
              基本收費已包括 2 隻貓，每多 1 隻加 $20（最多 {MAX_CATS} 隻）。
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                aria-label="減少貓隻數量"
                onClick={() => onChange("catCount", Math.max(1, state.catCount - 1))}
                disabled={state.catCount <= 1}
                className="h-10 w-10 rounded-lg bg-[#FFEDB9] text-lg font-bold text-[#4A3B32] transition-colors hover:bg-[#FFCB56] disabled:cursor-not-allowed disabled:opacity-40"
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
                className="w-20 rounded-lg border border-black/10 bg-[#FFF8E1] px-3 py-2 text-center text-[#4A3B32] outline-none focus:border-[#FFA259] focus:ring-2 focus:ring-[#FFA259]/30"
              />
              <button
                type="button"
                aria-label="增加貓隻數量"
                onClick={() =>
                  onChange("catCount", Math.min(MAX_CATS, state.catCount + 1))
                }
                disabled={state.catCount >= MAX_CATS}
                className="h-10 w-10 rounded-lg bg-[#FFEDB9] text-lg font-bold text-[#4A3B32] transition-colors hover:bg-[#FFCB56] disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
              <span className="text-xs text-[#4A3B32]/60">
                共 {state.catCount} 隻
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Date & time ── */}
      <h2 className="text-lg font-semibold text-[#4A3B32]">選擇日期及時間</h2>

      <div>
        <label htmlFor="booking-date" className="mb-2 block text-sm font-medium text-[#4A3B32]">
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

      {/* Quick-select time presets */}
      <div>
        <span className="mb-2 block text-sm font-medium text-[#4A3B32]">
          快速選擇時段
        </span>
        <div className="grid grid-cols-3 gap-2">
          {TIME_PRESETS.map((preset) => {
            const active =
              state.startTime === preset.start && state.endTime === preset.end;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onChange("startTime", preset.start);
                  onChange("endTime", preset.end);
                }}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#FFA259] text-white"
                    : "bg-[#FFEDB9] text-[#4A3B32] ring-1 ring-black/5 hover:bg-[#FFCB56]"
                }`}
              >
                <span>{preset.label}</span>
                <span
                  className={`text-[10px] font-normal ${
                    active ? "text-white/80" : "text-[#4A3B32]/60"
                  }`}
                >
                  {preset.sub} · {preset.start}–{preset.end}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start-time" className="mb-2 block text-sm font-medium text-[#4A3B32]">
            開始時間
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
          <label htmlFor="end-time" className="mb-2 block text-sm font-medium text-[#4A3B32]">
            結束時間
          </label>
          <input
            id="end-time"
            type="time"
            value={state.endTime}
            onChange={(e) => onChange("endTime", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

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
}: {
  state: WizardState;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isGuest: boolean;
  sessionResolved: boolean;
  sessionEmail: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#4A3B32]">聯絡資料及地址</h2>

      {/* Contact ------------------------------------------------------------ */}
      {!sessionResolved ? (
        <p className="text-xs text-[#4A3B32]/60">正在確認登入狀態⋯</p>
      ) : isGuest ? (
        <div className="flex flex-col gap-4 rounded-xl bg-[#FFF8E1] p-4 ring-1 ring-black/5">
          <div>
            <h3 className="text-sm font-semibold text-[#4A3B32]">聯絡人</h3>
            <p className="mt-0.5 text-xs text-[#4A3B32]/60">
              完成預約後，系統會寄出登入連結至你的電郵。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
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
        <div className="rounded-xl bg-[#FFCB56]/40 px-4 py-3 text-sm text-[#4A3B32]">
          登入帳戶：<strong>{sessionEmail}</strong>
        </div>
      )}

      {/* Address ------------------------------------------------------------ */}
      <Field label="詳細地址" htmlFor="address-full">
        <textarea
          id="address-full"
          rows={2}
          value={state.address}
          onChange={(e) => onChange("address", e.target.value)}
          placeholder="香港九龍⋯⋯"
          className={inputClass}
        />
      </Field>

      <Field label="進入方式及密碼（選填）" htmlFor="address-door">
        <input
          id="address-door"
          type="text"
          value={state.doorCode}
          onChange={(e) => onChange("doorCode", e.target.value)}
          placeholder="例如：大門密碼 #1234 / 管理處取匙"
          className={inputClass}
        />
      </Field>
    </div>
  );
}

/* ─────────────────────────── Step 3 ─────────────────────────── */

function StepThree({
  state,
  onChange,
  isGuest,
}: {
  state: WizardState;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isGuest: boolean;
}) {
  const serviceMeta = SERVICE_META[state.serviceType];
  const petLabel = serviceMeta.petType === "dog" ? "狗狗" : "貓貓";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-[#FFCB56]/40 px-4 py-3 text-xs text-[#4A3B32]">
        已選擇服務：<strong>{serviceMeta.label}</strong>（{serviceMeta.subtitle}）
        {isCatService(state.serviceType) && state.catCount > 1 && (
          <span className="ml-1">· 共 {state.catCount} 隻貓</span>
        )}
      </div>

      <h2 className="text-lg font-semibold text-[#4A3B32]">寵物資料</h2>

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
              min="0.1"
              max="100"
              value={state.petWeight}
              onChange={(e) => onChange("petWeight", e.target.value)}
              placeholder="例如：4.5"
              className={inputClass}
            />
          </Field>
        )}
      </div>

      {serviceMeta.petType === "dog" && (
        <p className="rounded-lg bg-[#FFF8E1] px-3 py-2 text-xs text-[#4A3B32]/70">
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
        <label className="flex items-center gap-3 text-sm text-[#4A3B32]">
          <input
            type="checkbox"
            checked={state.vaccinated}
            onChange={(e) => onChange("vaccinated", e.target.checked)}
            className="h-5 w-5 rounded border-black/20 accent-[#FFA259]"
          />
          已完成疫苗接種
        </label>
        <label className="flex items-center gap-3 text-sm text-[#4A3B32]">
          <input
            type="checkbox"
            checked={state.sterilized}
            onChange={(e) => onChange("sterilized", e.target.checked)}
            className="h-5 w-5 rounded border-black/20 accent-[#FFA259]"
          />
          已絕育 (Sterilized)
        </label>
        <label className="flex items-center gap-3 text-sm text-[#4A3B32]">
          <input
            type="checkbox"
            checked={state.contagious}
            onChange={(e) => onChange("contagious", e.target.checked)}
            className="h-5 w-5 rounded border-black/20 accent-[#FFA259]"
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

      {/* Documents: no pet record exists until POST /api/bookings runs, so
          uploads happen from the dashboard afterwards. */}
      <div className="rounded-xl border border-dashed border-black/15 bg-[#FFF8E1] p-4">
        <p className="text-sm font-semibold text-[#4A3B32]">文件上傳</p>
        {isGuest ? (
          <p className="mt-1 text-xs text-[#4A3B32]/70">
            Guests can upload vaccination records via the dashboard after
            booking.
          </p>
        ) : (
          <p className="mt-1 text-xs text-[#4A3B32]/70">
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
  onAgree,
}: {
  state: WizardState;
  isGuest: boolean;
  total: number;
  priceNotes: string[];
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
    { label: "日期", value: state.date || "—" },
    { label: "時間", value: `${state.startTime} – ${state.endTime}` },
    { label: "地址", value: state.address || "—" },
    { label: "進入方式及密碼", value: state.doorCode || "—" },
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
      <h2 className="text-lg font-semibold text-[#4A3B32]">確認預約詳情</h2>

      <dl className="divide-y divide-black/5 rounded-xl bg-[#FFF8E1] px-4 py-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-3 gap-2 py-2.5 text-sm">
            <dt className="font-medium text-[#4A3B32]/70">{row.label}</dt>
            <dd className="col-span-2 break-words text-[#4A3B32]">{row.value}</dd>
          </div>
        ))}
      </dl>

      <PriceSummary total={total} notes={priceNotes} />

      <label className="flex items-start gap-3 text-sm text-[#4A3B32]">
        <input
          type="checkbox"
          checked={state.agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-black/20 accent-[#FFA259]"
        />
        <span>
          我已閱讀並同意
          <Link href="/terms" className="font-semibold text-[#FFA259] underline">
            服務條款
          </Link>
          及
          <Link href="/privacy" className="font-semibold text-[#FFA259] underline">
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
  "w-full rounded-xl border border-black/10 bg-[#FFF8E1] px-4 py-3 text-[#4A3B32] outline-none placeholder:text-[#4A3B32]/40 focus:border-[#FFA259] focus:ring-2 focus:ring-[#FFA259]/30";

function PriceSummary({ total, notes }: { total: number; notes: string[] }) {
  return (
    <div className="rounded-xl bg-[#FFEDB9] px-4 py-3 ring-1 ring-black/5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[#4A3B32]">預計費用</span>
        <span className="text-xl font-bold text-[#4A3B32]">HK${total}</span>
      </div>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {notes.map((n) => (
            <li key={n} className="text-xs text-[#4A3B32]/65">
              · {n}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-[#4A3B32]/50">
        附加服務（如剪指甲、餵藥等）將於保姆確認後另行計算。
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
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-[#4A3B32]">
        {label}
      </label>
      {children}
    </div>
  );
}
