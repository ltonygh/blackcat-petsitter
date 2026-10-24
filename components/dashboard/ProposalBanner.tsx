"use client";

import { useState } from "react";

import { apiPatch, ApiError } from "@/components/lib/api";
import { formatDateTime } from "@/components/lib/format";
import type { BookingWithDetails } from "@/types";

interface ProposalBannerProps {
  booking: BookingWithDetails;
  /** Called after a successful accept/decline with the updated booking. */
  onResolved: (updated: BookingWithDetails) => void;
}

/**
 * Shown when a booking is `time_proposed`: presents the proposed window and
 * lets the customer Accept (status=accepted) or Decline (status=cancelled).
 */
export function ProposalBanner({ booking, onResolved }: ProposalBannerProps) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(kind: "accept" | "decline") {
    setError(null);
    setBusy(kind);
    try {
      const body =
        kind === "accept"
          ? { status: "accepted", proposalStatus: "accepted" }
          : { status: "cancelled", proposalStatus: "declined" };
      const { booking: updated } = await apiPatch<{
        booking: BookingWithDetails;
      }>(`/api/bookings/${booking.id}`, body);
      onResolved(
        updated ??
          ({
            ...booking,
            status: kind === "accept" ? "accepted" : "cancelled",
            proposalStatus: kind === "accept" ? "accepted" : "declined",
          } as BookingWithDetails),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "更新時間建議時發生錯誤。",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-sm font-semibold text-indigo-900">
        保姆建議了新的時間
      </p>
      <div className="mt-1 space-y-0.5 text-sm text-indigo-900/80">
        <p>
          開始：<span className="font-medium">{formatDateTime(booking.proposalStartTime)}</span>
        </p>
        <p>
          結束：<span className="font-medium">{formatDateTime(booking.proposalEndTime)}</span>
        </p>
        {booking.proposalReason && (
          <p className="mt-1 italic">備註：{booking.proposalReason}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => resolve("accept")}
          disabled={busy !== null}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy === "accept" ? "接受中⋯" : "接受新時間"}
        </button>
        <button
          type="button"
          onClick={() => resolve("decline")}
          disabled={busy !== null}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
        >
          {busy === "decline" ? "拒絕中⋯" : "拒絕"}
        </button>
      </div>
    </div>
  );
}
