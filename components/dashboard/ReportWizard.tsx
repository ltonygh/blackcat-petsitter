"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import { Stepper, type StepperStep } from "@/components/Stepper";
import { formatDate } from "@/components/lib/format";
import { COMPLETED_TASKS, UPCOMING_TASKS } from "@/components/lib/report-presets";
import { generateReportText } from "@/components/lib/report-text";
import type { BookingWithDetails } from "@/types";

const STEPS: StepperStep[] = [
  { id: 1, label: "選擇預約" },
  { id: 2, label: "填寫內容" },
  { id: 3, label: "預覽" },
  { id: 4, label: "複製並發送" },
];

interface ReportWizardProps {
  bookings: BookingWithDetails[];
  onClose: () => void;
}

/**
 * 4-step report generator. Step 2 collects categorised checklists plus free
 * text; step 3 previews the generated plain-text report; step 4 copies it.
 */
export function ReportWizard({ bookings, onClose }: ReportWizardProps) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Checklist + free-text state
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [observations, setObservations] = useState("");
  const [upcomingIds, setUpcomingIds] = useState<Set<string>>(new Set());
  const [customUpcoming, setCustomUpcoming] = useState("");
  const [otherNotes, setOtherNotes] = useState("");

  const [copied, setCopied] = useState(false);

  // Only completed bookings make sense in a report.
  const candidates = useMemo(
    () => bookings.filter((b) => b.status === "completed" || b.status === "paid"),
    [bookings],
  );

  const selectedBookings = useMemo(
    () => candidates.filter((b) => selected.has(b.id)),
    [candidates, selected],
  );

  /** The report describes one visit — the first selected booking. */
  const primary = selectedBookings[0] ?? null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleIn(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const reportText = useMemo(() => {
    if (!primary) return "";
    return generateReportText({
      booking: primary,
      completedIds,
      observations,
      upcomingIds,
      customUpcoming,
      otherNotes,
    });
  }, [
    primary,
    completedIds,
    observations,
    upcomingIds,
    customUpcoming,
    otherNotes,
  ]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  // Step 2 only needs *some* content — checklists alone are valid.
  const canNext =
    step === 1
      ? selected.size > 0
      : step === 2
        ? completedIds.size > 0 ||
          upcomingIds.size > 0 ||
          observations.trim().length > 0 ||
          customUpcoming.trim().length > 0 ||
          otherNotes.trim().length > 0
        : true;

  return (
    <Modal open title="生成服務報告" onClose={onClose} maxWidth="max-w-2xl">
      <div className="mb-5">
        <Stepper steps={STEPS} current={step} />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink/70">選擇要包含在報告中的預約：</p>
          {candidates.length === 0 && (
            <p className="rounded-xl bg-cream-50 px-4 py-3 text-sm text-ink/70">
              暫無可報告嘅預約（已完成／已付款）。
            </p>
          )}
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {candidates.map((b) => (
              <li key={b.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 hover:bg-black/5">
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={() => toggle(b.id)}
                    className="h-5 w-5 accent-primary"
                  />
                  <span className="text-sm text-ink">
                    {b.pet?.name ?? "—"} · {b.serviceType} ·{" "}
                    {formatDate(b.startTime)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {selected.size > 1 && (
            <p className="text-xs text-ink/60">
              報告會以第一份已選預約為準（{primary?.pet?.name ?? "—"}）。
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto pr-1">
          {/* A. Completed tasks */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              A. 是日完成事項
            </h3>
            <div className="flex flex-col gap-4">
              {COMPLETED_TASKS.map((group) => (
                <fieldset key={group.category}>
                  <legend className="mb-1.5 text-xs font-semibold text-ink/60">
                    {group.category}
                  </legend>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {group.tasks.map((task) => {
                      const id = `${group.category}::${task}`;
                      return (
                        <li key={id}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-cream-50 px-3 py-2 text-sm text-ink hover:bg-cream-100">
                            <input
                              type="checkbox"
                              checked={completedIds.has(id)}
                              onChange={() => toggleIn(setCompletedIds, id)}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                            />
                            <span>{displayTask(task, primary)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              ))}
            </div>
          </section>

          {/* B. Observations */}
          <section>
            <label htmlFor="report-observations" className="mb-1 block text-sm font-semibold text-ink">
              B. 觀察記錄
            </label>
            <p className="mb-1.5 text-xs text-ink/60">
              每一行將自動轉換為項目符號
            </p>
            <textarea
              id="report-observations"
              rows={4}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder={"例如：\n今日很活潑\n食慾正常"}
              className={textarea}
            />
          </section>

          {/* C. Follow-ups */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              C. 後續注意事項
            </h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {UPCOMING_TASKS.map((task) => (
                <li key={task}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-cream-50 px-3 py-2 text-sm text-ink hover:bg-cream-100">
                    <input
                      type="checkbox"
                      checked={upcomingIds.has(task)}
                      onChange={() => toggleIn(setUpcomingIds, task)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>{displayTask(task, primary)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <label htmlFor="report-custom-upcoming" className="mb-1 mt-3 block text-xs font-medium text-ink/70">
              其他後續事項（選填，每行一項）
            </label>
            <textarea
              id="report-custom-upcoming"
              rows={2}
              value={customUpcoming}
              onChange={(e) => setCustomUpcoming(e.target.value)}
              placeholder="例如：下週需要預約獸醫"
              className={textarea}
            />
          </section>

          {/* D. Other notes */}
          <section>
            <label htmlFor="report-other" className="mb-1 block text-sm font-semibold text-ink">
              D. 其他注意事項
            </label>
            <p className="mb-1.5 text-xs text-ink/60">
              每一行將自動轉換為項目符號
            </p>
            <textarea
              id="report-other"
              rows={3}
              value={otherNotes}
              onChange={(e) => setOtherNotes(e.target.value)}
              placeholder="例如：大門密碼已更改"
              className={textarea}
            />
          </section>
        </div>
      )}

      {step === 3 && (
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-cream-50 p-4 text-sm leading-relaxed text-ink">
          {reportText}
        </pre>
      )}

      {step === 4 && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-4xl" aria-hidden>
            {copied ? "✅" : "📋"}
          </p>
          <button
            type="button"
            onClick={() => void copy()}
            className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-600"
          >
            {copied ? "已複製！" : "複製報告到剪貼簿"}
          </button>
          <p className="text-xs text-ink/60">
            複製後可貼上到 WhatsApp 發送給客戶。
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={back}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink ring-1 ring-black/10 hover:bg-black/5"
          >
            上一步
          </button>
        ) : (
          <span />
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canNext}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-ink ring-1 ring-black/10 hover:bg-black/5"
          >
            完成
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Show placeholders filled in while ticking, so the sitter reads real names. */
function displayTask(task: string, booking: BookingWithDetails | null): string {
  const pet = booking?.pet?.name ?? "毛孩";
  const owner = booking?.customer?.name ?? booking?.guestName ?? "家長";
  return task.split("{寵物名字}").join(pet).split("{家長}").join(owner);
}

const textarea =
  "w-full rounded-xl border border-black/10 bg-cream-50 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-primary focus:ring-2 focus:ring-primary/30";
