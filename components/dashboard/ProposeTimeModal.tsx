"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { apiPatch, ApiError } from "@/components/lib/api";
import {
  isoToDatePart,
  isoToTimePart,
  toIso,
} from "@/components/lib/format";
import type { BookingWithDetails } from "@/types";

interface ProposeTimeModalProps {
  booking: BookingWithDetails;
  onClose: () => void;
  onProposed: (updated: BookingWithDetails) => void;
}

/**
 * Owner/staff "Propose New Time" modal. PATCHes the booking to
 * `time_proposed` with a new window + optional reason.
 */
export function ProposeTimeModal({
  booking,
  onClose,
  onProposed,
}: ProposeTimeModalProps) {
  const [date, setDate] = useState(isoToDatePart(booking.startTime) || "");
  const [startTime, setStartTime] = useState(
    isoToTimePart(booking.startTime) || "09:00",
  );
  const [endTime, setEndTime] = useState(
    isoToTimePart(booking.endTime) || "18:00",
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const start = toIso(date, startTime);
    const end = toIso(date, endTime);
    if (!start || !end) {
      setError("請選擇有效的日期及時間。");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      setError("結束時間必須晚於開始時間。");
      return;
    }
    setSubmitting(true);
    try {
      const { booking: updated } = await apiPatch<{
        booking: BookingWithDetails;
      }>(`/api/bookings/${booking.id}`, {
        status: "time_proposed",
        proposalStartTime: start,
        proposalEndTime: end,
        proposalReason: reason.trim() || null,
      });
      onProposed(updated ?? { ...booking, status: "time_proposed" });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "提交時間建議時發生錯誤。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="建議新時間" onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#4A3B32]/70">
          為 {booking.pet?.name ?? "此預約"} 建議一個新的服務時間。
        </p>

        <div>
          <label htmlFor="propose-date" className="mb-1 block text-sm font-medium text-[#4A3B32]">
            日期
          </label>
          <input
            id="propose-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={input}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="propose-start" className="mb-1 block text-sm font-medium text-[#4A3B32]">
              開始
            </label>
            <input
              id="propose-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="propose-end" className="mb-1 block text-sm font-medium text-[#4A3B32]">
              結束
            </label>
            <input
              id="propose-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={input}
            />
          </div>
        </div>

        <div>
          <label htmlFor="propose-reason" className="mb-1 block text-sm font-medium text-[#4A3B32]">
            原因（選填）
          </label>
          <textarea
            id="propose-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：該時段已有其他預約"
            className={input}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
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
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex-1 rounded-xl bg-[#FFA259] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff8f3d] disabled:opacity-50"
          >
            {submitting ? "提交中⋯" : "送出建議"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const input =
  "w-full rounded-xl border border-black/10 bg-[#FFF8E1] px-3 py-2 text-sm text-[#4A3B32] outline-none focus:border-[#FFA259] focus:ring-2 focus:ring-[#FFA259]/30";
