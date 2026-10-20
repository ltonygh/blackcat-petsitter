"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Stepper, type StepperStep } from "@/components/Stepper";

const STEPS: StepperStep[] = [
  { id: 1, label: "日期時間" },
  { id: 2, label: "聯絡資料" },
  { id: 3, label: "寵物資料" },
  { id: 4, label: "確認預約" },
];

const TIME_SLOTS = ["上午 (Morning)", "下午 (Afternoon)", "晚上 (Evening)"] as const;

type TimeSlot = (typeof TIME_SLOTS)[number];

interface WizardState {
  // Step 1
  date: string;
  timeSlot: TimeSlot | "";
  // Step 2
  name: string;
  phone: string;
  address: string;
  doorCode: string;
  // Step 3
  petName: string;
  petType: "cat" | "dog" | "other";
  petBreed: string;
  petNotes: string;
  // Step 4
  agreed: boolean;
}

const INITIAL_STATE: WizardState = {
  date: "",
  timeSlot: "",
  name: "",
  phone: "",
  address: "",
  doorCode: "",
  petName: "",
  petType: "cat",
  petBreed: "",
  petNotes: "",
  agreed: false,
};

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return Boolean(state.date && state.timeSlot);
      case 2:
        return Boolean(state.name && state.phone && state.address);
      case 3:
        return Boolean(state.petName);
      case 4:
        return state.agreed;
      default:
        return true;
    }
  };

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = () => {
    // Submission is intentionally not wired up yet (Phase 1 scaffold).
    // Next phase will POST to /api/bookings.
    alert("預約已提交（示範模式，尚未連接伺服器）");
  };

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

      {/* Stepper */}
      <div className="mb-8 rounded-2xl bg-white px-4 py-5 ring-1 ring-black/5 sm:px-6">
        <Stepper steps={STEPS} current={step} />
      </div>

      {/* Step content card */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-8">
        {step === 1 && (
          <StepOne
            date={state.date}
            timeSlot={state.timeSlot}
            onDate={(v) => update("date", v)}
            onTimeSlot={(v) => update("timeSlot", v)}
          />
        )}
        {step === 2 && (
          <StepTwo
            name={state.name}
            phone={state.phone}
            address={state.address}
            doorCode={state.doorCode}
            onChange={update}
          />
        )}
        {step === 3 && (
          <StepThree
            petName={state.petName}
            petType={state.petType}
            petBreed={state.petBreed}
            petNotes={state.petNotes}
            onChange={update}
          />
        )}
        {step === 4 && (
          <StepFour state={state} onAgree={(v) => update("agreed", v)} />
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
              onClick={handleSubmit}
              disabled={!canProceed()}
              className="rounded-xl bg-[#FFA259] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              提交預約
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────── Step 1 ─────────────────────────── */

function StepOne({
  date,
  timeSlot,
  onDate,
  onTimeSlot,
}: {
  date: string;
  timeSlot: TimeSlot | "";
  onDate: (v: string) => void;
  onTimeSlot: (v: TimeSlot) => void;
}) {
  // Compute "today" only after mount so we never read an unstable value
  // (new Date()) during prerender, which Next 16's Cache Components reject.
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-[#4A3B32]">選擇日期及時間</h2>

      <div>
        <label
          htmlFor="booking-date"
          className="mb-2 block text-sm font-medium text-[#4A3B32]"
        >
          日期
        </label>
        {/* Calendar placeholder — a real calendar picker comes later. */}
        <input
          id="booking-date"
          type="date"
          min={today}
          value={date}
          onChange={(e) => onDate(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-[#FFF8E1] px-4 py-3 text-[#4A3B32] outline-none focus:border-[#FFA259] focus:ring-2 focus:ring-[#FFA259]/30"
        />
        <p className="mt-1 text-xs text-[#4A3B32]/60">
          （日曆選擇器將於稍後階段完善）
        </p>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-[#4A3B32]">
          時段
        </span>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onTimeSlot(slot)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                timeSlot === slot
                  ? "border-[#FFA259] bg-[#FFA259] text-white"
                  : "border-black/10 bg-white text-[#4A3B32] hover:bg-[#FFCB56]/30"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Step 2 ─────────────────────────── */

function StepTwo({
  name,
  phone,
  address,
  doorCode,
  onChange,
}: {
  name: string;
  phone: string;
  address: string;
  doorCode: string;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#4A3B32]">聯絡資料及地址</h2>

      <Field label="姓名" htmlFor="contact-name">
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="陳大文"
          className={inputClass}
        />
      </Field>

      <Field label="電話" htmlFor="contact-phone">
        <input
          id="contact-phone"
          type="tel"
          value={phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="9123 4567"
          className={inputClass}
        />
      </Field>

      <Field label="地址" htmlFor="contact-address">
        <textarea
          id="contact-address"
          rows={2}
          value={address}
          onChange={(e) => onChange("address", e.target.value)}
          placeholder="香港九龍⋯⋯"
          className={inputClass}
        />
      </Field>

      <Field label="大門密碼（選填）" htmlFor="contact-door">
        <input
          id="contact-door"
          type="text"
          value={doorCode}
          onChange={(e) => onChange("doorCode", e.target.value)}
          placeholder="例如 #1234"
          className={inputClass}
        />
      </Field>
    </div>
  );
}

/* ─────────────────────────── Step 3 ─────────────────────────── */

function StepThree({
  petName,
  petType,
  petBreed,
  petNotes,
  onChange,
}: {
  petName: string;
  petType: "cat" | "dog" | "other";
  petBreed: string;
  petNotes: string;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const types: { value: WizardState["petType"]; label: string; icon: string }[] =
    [
      { value: "cat", label: "貓", icon: "🐈" },
      { value: "dog", label: "狗", icon: "🐕" },
      { value: "other", label: "其他", icon: "🐾" },
    ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#4A3B32]">寵物資料</h2>

      <div>
        <span className="mb-2 block text-sm font-medium text-[#4A3B32]">
          寵物類型
        </span>
        <div className="grid grid-cols-3 gap-3">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange("petType", t.value)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                petType === t.value
                  ? "border-[#FFA259] bg-[#FFA259] text-white"
                  : "border-black/10 bg-white text-[#4A3B32] hover:bg-[#FFCB56]/30"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="寵物名稱" htmlFor="pet-name">
        <input
          id="pet-name"
          type="text"
          value={petName}
          onChange={(e) => onChange("petName", e.target.value)}
          placeholder="例如：花花"
          className={inputClass}
        />
      </Field>

      <Field label="品種（選填）" htmlFor="pet-breed">
        <input
          id="pet-breed"
          type="text"
          value={petBreed}
          onChange={(e) => onChange("petBreed", e.target.value)}
          placeholder="例如：英國短毛貓"
          className={inputClass}
        />
      </Field>

      <Field label="其他注意事項（選填）" htmlFor="pet-notes">
        <textarea
          id="pet-notes"
          rows={3}
          value={petNotes}
          onChange={(e) => onChange("petNotes", e.target.value)}
          placeholder="飲食習慣、性格、健康狀況等"
          className={inputClass}
        />
      </Field>
    </div>
  );
}

/* ─────────────────────────── Step 4 ─────────────────────────── */

function StepFour({
  state,
  onAgree,
}: {
  state: WizardState;
  onAgree: (v: boolean) => void;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "日期", value: state.date || "—" },
    { label: "時段", value: state.timeSlot || "—" },
    { label: "姓名", value: state.name || "—" },
    { label: "電話", value: state.phone || "—" },
    { label: "地址", value: state.address || "—" },
    { label: "大門密碼", value: state.doorCode || "—" },
    {
      label: "寵物",
      value: state.petName
        ? `${state.petName}${state.petBreed ? `（${state.petBreed}）` : ""}`
        : "—",
    },
    { label: "注意事項", value: state.petNotes || "—" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#4A3B32]">確認預約詳情</h2>

      <dl className="divide-y divide-black/5 rounded-xl bg-[#FFF8E1] px-4 py-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-3 gap-2 py-2.5 text-sm"
          >
            <dt className="font-medium text-[#4A3B32]/70">{row.label}</dt>
            <dd className="col-span-2 break-words text-[#4A3B32]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <label className="flex items-start gap-3 text-sm text-[#4A3B32]">
        <input
          type="checkbox"
          checked={state.agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-black/20 accent-[#FFA259]"
        />
        <span>
          我已閱讀並同意
          <Link href="#" className="font-semibold text-[#FFA259] underline">
            服務條款
          </Link>
          及
          <Link href="#" className="font-semibold text-[#FFA259] underline">
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
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-[#4A3B32]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
