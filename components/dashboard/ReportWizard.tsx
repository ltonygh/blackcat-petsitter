"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import { Stepper, type StepperStep } from "@/components/Stepper";
import { formatDate } from "@/components/lib/format";
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
 * 4-step report generator. Builds a plain-text report for the selected
 * bookings and lets the user copy it to the clipboard to paste into WhatsApp.
 */
export function ReportWizard({ bookings, onClose }: ReportWizardProps) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visits, setVisits] = useState("");
  const [notes, setNotes] = useState("");
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const reportText = useMemo(() => {
    const lines: string[] = [];
    lines.push("🐈‍⬛ Blackcat.petsitter 服務報告");
    lines.push("");
    for (const b of selectedBookings) {
      lines.push(`• 寵物：${b.pet?.name ?? "—"}`);
      lines.push(`  服務：${b.serviceType}`);
      lines.push(`  日期：${formatDate(b.startTime)}`);
      if (b.customer?.name || b.guestName) {
        lines.push(`  客戶：${b.customer?.name ?? b.guestName}`);
      }
      lines.push("");
    }
    if (visits.trim()) {
      lines.push("服務紀錄：");
      lines.push(visits.trim());
      lines.push("");
    }
    if (notes.trim()) {
      lines.push("備註：");
      lines.push(notes.trim());
      lines.push("");
    }
    lines.push("感謝你選用 Blackcat.petsitter！");
    return lines.join("\n");
  }, [selectedBookings, visits, notes]);

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

  const canNext =
    step === 1 ? selected.size > 0 : step === 2 ? visits.trim().length > 0 : true;

  return (
    <Modal open title="生成服務報告" onClose={onClose} maxWidth="max-w-xl">
      <div className="mb-5">
        <Stepper steps={STEPS} current={step} />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#4A3B32]/70">選擇要包含在報告中的預約：</p>
          {candidates.length === 0 && (
            <p className="rounded-xl bg-[#FFF8E1] px-4 py-3 text-sm text-[#4A3B32]/70">
              暂無可報告嘅預約（已完成／已付款）。
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
                    className="h-5 w-5 accent-[#FFA259]"
                  />
                  <span className="text-sm text-[#4A3B32]">
                    {b.pet?.name ?? "—"} · {b.serviceType} ·{" "}
                    {formatDate(b.startTime)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="report-visits" className="mb-1 block text-sm font-medium text-[#4A3B32]">
              服務紀錄
            </label>
            <textarea
              id="report-visits"
              rows={5}
              value={visits}
              onChange={(e) => setVisits(e.target.value)}
              placeholder="例如：10:00 到達，餵食、清貓砂、陪玩 30 分鐘⋯"
              className={textarea}
            />
          </div>
          <div>
            <label htmlFor="report-notes" className="mb-1 block text-sm font-medium text-[#4A3B32]">
              備註（選填）
            </label>
            <textarea
              id="report-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="任何需要注意嘅事項"
              className={textarea}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#FFF8E1] p-4 text-sm text-[#4A3B32]">
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
            className="w-full rounded-xl bg-[#FFA259] px-5 py-3 text-sm font-semibold text-white hover:bg-[#ff8f3d]"
          >
            {copied ? "已複製！" : "複製報告到剪貼簿"}
          </button>
          <p className="text-xs text-[#4A3B32]/60">
            複製後可貼上到 WhatsApp 發送給客戶。
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={back}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5"
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
            className="rounded-xl bg-[#FFA259] px-5 py-2 text-sm font-semibold text-white hover:bg-[#ff8f3d] disabled:opacity-40"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5"
          >
            完成
          </button>
        )}
      </div>
    </Modal>
  );
}

const textarea =
  "w-full rounded-xl border border-black/10 bg-[#FFF8E1] px-3 py-2 text-sm text-[#4A3B32] outline-none focus:border-[#FFA259] focus:ring-2 focus:ring-[#FFA259]/30";
