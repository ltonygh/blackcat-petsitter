"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { apiPatch, ApiError } from "@/components/lib/api";
import { formatHkd } from "@/components/lib/format";
import type { BookingWithDetails } from "@/types";

interface PayNowModalProps {
  booking: BookingWithDetails;
  onClose: () => void;
  onPaid: (updated: BookingWithDetails) => void;
}

type Method = "fps" | "payme";

/** Displayed under the FPS QR so users can pay manually if scanning fails. */
const FPS_ID = "134258763";
const FPS_ID_NAME = "Blackcat.petsitter";

/**
 * Payment modal with two tabs (FPS / PayMe).
 *
 * FPS is the default: the PayMe account is temporarily unavailable, so that
 * tab is shown but disabled with a placeholder. On "我已付款" we PATCH the
 * booking to `verification_pending`, then notify the parent to refresh.
 */
export function PayNowModal({ booking, onClose, onPaid }: PayNowModalProps) {
  const [method, setMethod] = useState<Method>("fps");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adjusted =
    booking.previousTotalHkd !== null &&
    booking.previousTotalHkd !== undefined &&
    booking.previousTotalHkd !== booking.totalHkd;

  async function handlePaid() {
    setError(null);
    setSubmitting(true);
    try {
      const { booking: updated } = await apiPatch<{
        booking: BookingWithDetails;
      }>(`/api/bookings/${booking.id}`, { status: "verification_pending" });
      onPaid(updated ?? { ...booking, status: "verification_pending" });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "提交付款狀態時發生錯誤，請重試。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="付款" onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-ink/80">
          請使用您的銀行 App 或 PayMe 掃描 QR Code 付款。完成後，請點擊下方按鈕並將截圖發送給保姆。
        </p>

        {/* Amount */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-ink">
            {formatHkd(booking.totalHkd)}
          </span>
          {adjusted && (
            <>
              <span className="text-sm text-gray-400 line-through">
                {formatHkd(booking.previousTotalHkd as number)}
              </span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                保姆已調整價格
              </span>
            </>
          )}
        </div>

        {/* Method tabs */}
        <div
          role="tablist"
          aria-label="付款方式"
          className="flex w-full gap-1 rounded-xl bg-cream-50 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={method === "fps"}
            onClick={() => setMethod("fps")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              method === "fps"
                ? "bg-primary text-white"
                : "text-ink hover:bg-black/5"
            }`}
          >
            FPS 轉數快
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === "payme"}
            onClick={() => setMethod("payme")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              method === "payme"
                ? "bg-primary text-white"
                : "text-ink hover:bg-black/5"
            }`}
          >
            PayMe
          </button>
        </div>

        {/* ── FPS panel ── */}
        {method === "fps" && (
          <div
            role="tabpanel"
            aria-label="FPS 轉數快"
            className="flex flex-col items-center gap-3"
          >
            <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
              {/* Plain <img>: SVG needs no optimisation. */}
              <img
                src="/fps_qrcode.svg"
                alt="FPS 轉數快 QR code"
                width={224}
                height={224}
                className="h-56 w-56 object-contain"
              />
            </div>
            <p className="text-xs text-ink/70">
              FPS ID: {FPS_ID} ({FPS_ID_NAME})
            </p>
          </div>
        )}

        {/* ── PayMe panel (temporarily unavailable) ── */}
        {method === "payme" && (
          <div
            role="tabpanel"
            aria-label="PayMe"
            className="flex w-full flex-col items-center gap-3"
          >
            <div className="flex h-56 w-56 flex-col items-center justify-center rounded-2xl bg-gray-100 px-6 text-center ring-1 ring-gray-200">
              <span className="text-3xl" aria-hidden>
                ⚠️
              </span>
              <p className="mt-2 text-sm font-semibold text-gray-600">
                PayMe 暫時無法使用
              </p>
              <p className="mt-1 text-xs text-gray-500">
                PayMe temporarily unavailable
              </p>
            </div>
            <p className="text-center text-xs text-ink/60">
              請改用 FPS 轉數快付款，或聯絡保姆安排其他方式。
            </p>
          </div>
        )}

        <div className="w-full rounded-xl bg-cream-50 px-4 py-3 text-xs text-ink/70">
          預約編號：{booking.id.slice(0, 8)} · 服務：{booking.serviceType}
        </div>

        {error && (
          <div
            role="alert"
            className="w-full rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            {error}
          </div>
        )}

        <div className="mt-1 flex w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-black/10 hover:bg-black/5 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handlePaid}
            disabled={submitting || method === "payme"}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "提交中⋯" : "我已付款"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
