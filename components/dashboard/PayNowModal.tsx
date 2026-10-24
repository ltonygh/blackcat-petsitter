"use client";

import Image from "next/image";
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

/**
 * Payment modal: shows the PayMe QR, and on "I Have Paid" PATCHes the booking
 * to `verification_pending`, then notifies the parent to refresh.
 */
export function PayNowModal({ booking, onClose, onPaid }: PayNowModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Modal open title="付款 (PayMe)" onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-[#4A3B32]/80">
          請使用 PayMe 掃描下方 QR 碼，支付{" "}
          <span className="font-semibold text-[#4A3B32]">
            {formatHkd(booking.totalHkd)}
          </span>
          ，完成後按「我已付款」。
        </p>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
          <Image
            src="/payme-qr.png"
            alt="PayMe QR code"
            width={240}
            height={240}
            className="h-56 w-56 object-contain"
            unoptimized
          />
        </div>

        <div className="w-full rounded-xl bg-[#FFF8E1] px-4 py-3 text-xs text-[#4A3B32]/70">
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
            className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handlePaid}
            disabled={submitting}
            className="flex-1 rounded-xl bg-[#FFA259] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff8f3d] disabled:opacity-50"
          >
            {submitting ? "提交中⋯" : "我已付款"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
