"use client";

import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPatch, ApiError } from "@/components/lib/api";
import { formatDateTime, formatHkd } from "@/components/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingWithDetails } from "@/types";
import { ProposeTimeModal } from "./ProposeTimeModal";
import { ReportWizard } from "./ReportWizard";
import { StaffBookingDetailModal } from "./StaffBookingDetailModal";

type LoadState = "loading" | "error" | "ready";

/**
 * Guest bookings have no `customer.name` (the `users` table has no name
 * column), so fall back to the guest contact details stored on the booking.
 */
function customerLabel(b: BookingWithDetails): string {
  return (
    b.customer?.name ??
    b.guestName ??
    b.customer?.email ??
    b.guestEmail ??
    "—"
  );
}

function customerPhone(b: BookingWithDetails): string | null {
  return b.customer?.phone ?? b.guestPhone ?? null;
}


interface BookingsManagerProps {
  /** "owner" can verify payments; "staff" cannot. Both can propose time + report. */
  mode: "owner" | "staff";
  title: string;
  subtitle: string;
}

/**
 * Shared owner/staff bookings console.
 *
 * Data source: `GET /api/bookings` is role-scoped server-side (owner -> all
 * org bookings; staff -> only bookings assigned to them), so no filter is
 * passed from the client.
 */
export function BookingsManager({ mode, title, subtitle }: BookingsManagerProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [proposeTarget, setProposeTarget] = useState<BookingWithDetails | null>(
    null,
  );
  const [detailTarget, setDetailTarget] = useState<BookingWithDetails | null>(
    null,
  );
  /** Bookings handed to the report wizard (one, or all completed ones). */
  const [reportScope, setReportScope] = useState<BookingWithDetails[] | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"ok" | "err">("ok");

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const data = await apiGet<{ bookings: BookingWithDetails[] }>(
        "/api/bookings",
      );
      setBookings(data.bookings ?? []);
      setState("ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "無法載入預約。");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = useCallback((updated: BookingWithDetails) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
    );
  }, []);

  const showToast = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    setToast(msg);
    setToastTone(tone);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  /** Apply a status transition and merge the result back into the list. */
  async function setStatus(
    booking: BookingWithDetails,
    status: "accepted" | "rejected" | "paid",
    label: string,
  ) {
    setBusyId(booking.id);
    try {
      const { booking: updated } = await apiPatch<{
        booking: BookingWithDetails;
      }>(`/api/bookings/${booking.id}`, { status });
      // PATCH returns the bare row (no joined pet/customer/address), so keep
      // the enriched fields from the list response.
      replace(updated ? { ...booking, ...updated } : { ...booking, status });
      setDetailTarget(null);
      showToast(label);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "更新狀態失敗。",
        "err",
      );
    } finally {
      setBusyId(null);
    }
  }

  const completed = bookings.filter((b) => b.status === "completed");
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#4A3B32]">{title}</h1>
          <p className="mt-1 text-sm text-[#4A3B32]/70">{subtitle}</p>
          {pendingCount > 0 && (
            <p className="mt-1 text-xs font-semibold text-[#FFA259]">
              {pendingCount} 個預約待處理
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5"
          >
            重新整理
          </button>
          {/* Report generation lives in the detail modal (completed only);
              this bulk shortcut covers all completed visits at once. */}
          {completed.length > 0 && (
            <button
              type="button"
              onClick={() => setReportScope(completed)}
              className="rounded-xl bg-[#FFCB56] px-4 py-2 text-sm font-semibold text-[#4A3B32] hover:bg-[#ffbe3a]"
            >
              批量生成報告
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm ring-1 ${
            toastTone === "ok"
              ? "bg-green-50 text-green-800 ring-green-200"
              : "bg-red-50 text-red-800 ring-red-200"
          }`}
        >
          {toast}
        </div>
      )}

      {state === "loading" && (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="animate-pulse rounded-2xl bg-white p-5 ring-1 ring-black/5"
            >
              <div className="h-4 w-1/3 rounded bg-black/10" />
              <div className="mt-3 h-3 w-2/3 rounded bg-black/5" />
            </li>
          ))}
        </ul>
      )}

      {state === "error" && (
        <div className="rounded-2xl bg-red-50 p-6 text-center ring-1 ring-red-200">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            重試
          </button>
        </div>
      )}

      {state === "ready" && bookings.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-black/5">
          <p className="text-4xl" aria-hidden>
            📭
          </p>
          <p className="mt-3 text-base font-semibold text-[#4A3B32]">暫無預約</p>
        </div>
      )}

      {state === "ready" && bookings.length > 0 && (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="rounded-2xl bg-white p-5 ring-1 ring-black/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDetailTarget(booking)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[#4A3B32]">
                      {booking.pet?.name ?? "—"}
                    </h2>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="mt-1 text-sm text-[#4A3B32]/70">
                    {booking.serviceType} · {formatHkd(booking.totalHkd)}
                  </p>
                  <p className="text-sm text-[#4A3B32]/70">
                    {formatDateTime(booking.startTime)} →{" "}
                    {formatDateTime(booking.endTime)}
                  </p>
                  <p className="text-sm text-[#4A3B32]/70">
                    客戶：{customerLabel(booking)}
                    {customerPhone(booking) ? ` · ${customerPhone(booking)}` : ""}
                  </p>
                  {booking.address && (
                    <p className="text-sm text-[#4A3B32]/70">
                      地址：{booking.address.fullAddress}
                    </p>
                  )}
                  {booking.status === "time_proposed" &&
                    booking.proposalStartTime && (
                      <p className="mt-1 text-xs text-indigo-700">
                        已建議時間：{formatDateTime(booking.proposalStartTime)} →{" "}
                        {formatDateTime(booking.proposalEndTime)}
                      </p>
                    )}
                  <span className="mt-2 inline-block text-xs font-semibold text-[#FFA259]">
                    查看詳情 →
                  </span>
                </button>

                <div className="flex flex-col items-end gap-2">
                  {/* Pending: accept / reject */}
                  {booking.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void setStatus(booking, "accepted", "已接受預約。")
                        }
                        disabled={busyId === booking.id}
                        className="rounded-xl bg-[#FFA259] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff8f3d] disabled:opacity-50"
                      >
                        接受
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void setStatus(booking, "rejected", "已拒絕預約。")
                        }
                        disabled={busyId === booking.id}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        拒絕
                      </button>
                    </div>
                  )}

                  {/* Verification pending: owner confirms payment */}
                  {mode === "owner" &&
                    booking.status === "verification_pending" && (
                      <button
                        type="button"
                        onClick={() =>
                          void setStatus(booking, "paid", "已確認收款。")
                        }
                        disabled={busyId === booking.id}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {busyId === booking.id ? "確認中⋯" : "確認收款"}
                      </button>
                    )}

                  {(booking.status === "pending" ||
                    booking.status === "accepted") && (
                    <button
                      type="button"
                      onClick={() => setProposeTarget(booking)}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5"
                    >
                      建議新時間
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {detailTarget && (
        <StaffBookingDetailModal
          booking={detailTarget}
          mode={mode}
          onClose={() => setDetailTarget(null)}
          onGenerateReport={(b) => setReportScope([b])}
        />
      )}

      {proposeTarget && (
        <ProposeTimeModal
          booking={proposeTarget}
          onClose={() => setProposeTarget(null)}
          onProposed={(updated) => {
            replace(updated);
            setProposeTarget(null);
            showToast("已送出時間建議。");
          }}
        />
      )}

      {reportScope && (
        <ReportWizard
          bookings={reportScope}
          onClose={() => setReportScope(null)}
        />
      )}
    </section>
  );
}
