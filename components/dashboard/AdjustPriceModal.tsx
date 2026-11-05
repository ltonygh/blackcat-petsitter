"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { apiPatch, ApiError } from "@/components/lib/api";
import { formatHkd } from "@/components/lib/format";
import type { BookingWithDetails } from "@/types";

interface AdjustPriceModalProps {
  booking: BookingWithDetails;
  onClose: () => void;
  /** Parent merges the updated row back into its list. */
  onAdjusted: (updated: BookingWithDetails) => void;
}

/**
 * Owner price adjustment.
 *
 * Sends `PATCH /api/bookings/[id]` with `{ totalHkd }` only — that endpoint
 * accepts a non-negative integer and logs a `price_adjusted` booking event
 * server-side. There is no field for a free-text reason, so the reason here
 * is for the owner's own reference while typing and is NOT persisted.
 */
export function AdjustPriceModal({
  booking,
  onClose,
  onAdjusted,
}: AdjustPriceModalProps) {
  const [newTotal, setNewTotal] = useState(String(booking.totalHkd));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(newTotal);
  const isInteger = Number.isInteger(parsed);
  const valid = newTotal.trim() !== "" && isInteger && parsed >= 0;
  const changed = valid && parsed !== booking.totalHkd;
  const delta = valid ? parsed - booking.totalHkd : 0;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const { booking: updated } = await apiPatch<{
        booking: BookingWithDetails;
      }>(`/api/bookings/${booking.id}`, { totalHkd: parsed });
      // The PATCH response is the bare row; keep the enriched joins.
      onAdjusted(updated ? { ...booking, ...updated } : { ...booking, totalHkd: parsed });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "調整價格失敗，請重試。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="調整價格" maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        {/* Current price */}
        <div className="flex items-baseline justify-between rounded-xl bg-surface px-4 py-3">
          <span className="text-sm text-text/70">目前總額</span>
          <span className="text-lg font-bold text-text">
            {formatHkd(booking.totalHkd)}
          </span>
        </div>

        <div>
          <label
            htmlFor="adjust-total"
            className="mb-2 block text-sm font-medium text-text"
          >
            新總額 (New Total, HK$)
          </label>
          <input
            id="adjust-total"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={newTotal}
            onChange={(e) => setNewTotal(e.target.value)}
            className={inputClass}
          />
          {!valid && newTotal.trim() !== "" && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              請輸入非負整數金額。
            </p>
          )}
          {changed && (
            <p className="mt-1 text-xs text-text/60">
              差額：{delta > 0 ? "+" : "−"}
              {formatHkd(Math.abs(delta))}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="adjust-reason"
            className="mb-2 block text-sm font-medium text-text"
          >
            原因（選填）
          </label>
          <input
            id="adjust-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：交通費、額外護理"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-text/50">
            原因僅供你填寫時參考，暫不會儲存至系統。
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!changed || saving}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "儲存中⋯" : "儲存價格"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-text ring-1 ring-black/10 hover:bg-black/5 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-xl border border-black/10 bg-surface px-4 py-3 text-text outline-none placeholder:text-text/40 focus:border-primary focus:ring-2 focus:ring-primary/30";
