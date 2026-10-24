"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { apiPatch, ApiError } from "@/components/lib/api";
import { formatDateTime, formatHkd } from "@/components/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingWithDetails } from "@/types";

/** Statuses where the customer is still allowed to cancel. */
const CANCELLABLE = new Set(["pending", "accepted", "time_proposed", "paid"]);

interface BookingDetailModalProps {
  booking: BookingWithDetails;
  onClose: () => void;
  onCancelled: (updated: BookingWithDetails) => void;
}

/**
 * "View Details" modal: full read-only booking summary plus a Cancel action
 * that collects a reason and PATCHes `{ status: "cancelled", cancellationReason }`.
 */
export function BookingDetailModal({
  booking,
  onClose,
  onCancelled,
}: BookingDetailModalProps) {
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = CANCELLABLE.has(booking.status);
  const address = booking.address;
  // Paid bookings go through a "request" flow with a forfeiture warning.
  const isPaid = booking.status === "paid";
  const cancelLabel = isPaid ? "申請取消" : "取消預約";

  async function handleCancel() {
    setSubmitting(true);
    setError(null);
    try {
      // The API has no `cancellation_requested` status yet, so both paths
      // record a plain cancellation; the reason distinguishes them.
      const { booking: updated } = await apiPatch<{
        booking: BookingWithDetails;
      }>(`/api/bookings/${booking.id}`, {
        status: "cancelled",
        cancellationReason: reason.trim() || null,
      });
      // The PATCH response omits the joined fields; merge onto the original.
      onCancelled({ ...booking, ...updated });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消預約失敗，請重試。");
    } finally {
      setSubmitting(false);
    }
  }

  const rows: { label: string; value: string }[] = [
    { label: "服務", value: booking.serviceType },
    { label: "開始時間", value: formatDateTime(booking.startTime) },
    { label: "結束時間", value: formatDateTime(booking.endTime) },
    { label: "寵物", value: booking.pet?.name ?? "—" },
    { label: "寵物類型", value: petTypeLabel(booking.pet?.type) },
    ...(booking.pet?.breed
      ? [{ label: "品種", value: booking.pet.breed }]
      : []),
    ...(booking.pet?.weightKg != null && booking.pet.weightKg !== ""
      ? [{ label: "體重", value: `${booking.pet.weightKg} kg` }]
      : []),
    { label: "疫苗接種", value: yesNo(booking.pet?.vaccinated) },
    { label: "已絕育", value: yesNo(booking.pet?.sterilized) },
    ...(booking.pet?.contagious
      ? [{ label: "傳染病", value: "有（已申報）" }]
      : []),
    { label: "詳細地址", value: address?.fullAddress ?? "—" },
    { label: "進入方式及密碼", value: address?.doorCode || "—" },
    ...(booking.pet?.appearance
      ? [{ label: "外觀與性格", value: booking.pet.appearance }]
      : []),
    ...(booking.pet?.notes
      ? [{ label: "注意事項", value: booking.pet.notes }]
      : []),
    { label: "費用", value: formatHkd(booking.totalHkd) },
  ];

  return (
    <Modal open onClose={onClose} title="預約詳情" maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={booking.status} />
          <span className="text-xs text-[#4A3B32]/50">
            編號：{booking.id.slice(0, 8)}
          </span>
        </div>

        <dl className="divide-y divide-black/5 rounded-xl bg-[#FFF8E1] px-4 py-1">
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

        {booking.status === "time_proposed" && booking.proposalStartTime && (
          <div className="rounded-xl bg-[#FFEDB9] px-4 py-3 text-sm text-[#4A3B32]">
            <p className="font-semibold">保姆建議新時間</p>
            <p className="mt-1 text-xs">
              {formatDateTime(booking.proposalStartTime)} →{" "}
              {formatDateTime(booking.proposalEndTime ?? booking.endTime)}
            </p>
            {booking.proposalReason && (
              <p className="mt-1 text-xs text-[#4A3B32]/70">
                原因：{booking.proposalReason}
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Cancel flow ------------------------------------------------------ */}
        {canCancel && !showCancel && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50"
          >
            {cancelLabel}
          </button>
        )}

        {showCancel && (
          <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
            {/* 7-day deposit forfeiture policy */}
            <div
              role="alert"
              className="rounded-r-lg border-l-4 border-red-500 bg-red-100 p-3 text-sm text-red-800"
            >
              <p className="font-semibold">⚠️ 取消政策提醒</p>
              <p className="mt-1 text-xs leading-relaxed">
                如於服務開始前 **7 日內**取消，已繳付的訂金將不獲退還（訂金會被沒收）。
                如於 7 日前取消，訂金可獲退還或保留作下次預約之用。
              </p>
              {isPaid && (
                <p className="mt-1 text-xs font-medium">
                  此預約已完成付款，取消申請需由保姆確認。
                </p>
              )}
            </div>

            <label
              htmlFor="cancel-reason"
              className="mt-3 block text-sm font-semibold text-red-800"
            >
              請填寫取消原因
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：行程有變，暫時未能安排。"
              className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-[#4A3B32] outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
            />
            <p className="mt-1 text-xs text-red-700/70">
              取消後不可復原，如需重新預約請再次提交。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={submitting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "處理中⋯" : `確認${cancelLabel}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancel(false);
                  setError(null);
                }}
                disabled={submitting}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5 disabled:opacity-50"
              >
                返回
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function petTypeLabel(type: string | undefined): string {
  switch (type) {
    case "dog":
      return "狗狗";
    case "cat":
      return "貓貓";
    case "other":
      return "其他";
    default:
      return "—";
  }
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "是";
  if (value === false) return "否";
  return "—";
}
