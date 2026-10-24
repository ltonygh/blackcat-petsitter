"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiGet, ApiError } from "@/components/lib/api";
import { formatDateTime, formatHkd } from "@/components/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingWithDetails } from "@/types";
import { PayNowModal } from "./PayNowModal";
import { ProposalBanner } from "./ProposalBanner";
import { BookingDetailModal } from "./BookingDetailModal";
import { ProfileSettingsModal } from "./ProfileSettingsModal";

type LoadState = "loading" | "error" | "ready";

/**
 * Fetches and renders the current user's bookings, with a Pay Now flow for
 * accepted bookings and an accept/decline banner for proposed times.
 * `GET /api/bookings` is role-scoped server-side, so for a `user` this is
 * exactly their own bookings.
 */
export function UserBookings() {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [payTarget, setPayTarget] = useState<BookingWithDetails | null>(null);
  const [detailTarget, setDetailTarget] = useState<BookingWithDetails | null>(
    null,
  );
  const [showProfile, setShowProfile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      setError(
        err instanceof ApiError
          ? err.message
          : "無法載入預約，請稍後再試。",
      );
      setState("error");
    }
  }, []);

  /** The modal fetches its own data; nothing to load up front. */
  const openProfile = useCallback(() => setShowProfile(true), []);

  useEffect(() => {
    void load();
  }, [load]);

  // Replace a single booking in place after a mutation.
  const replaceBooking = useCallback((updated: BookingWithDetails) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
    );
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#4A3B32]">我的預約</h1>
          <p className="mt-1 text-sm text-[#4A3B32]/70">
            查看預約狀態、付款及處理保姆嘅時間建議。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void openProfile()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5"
          >
            個人資料
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5"
          >
            重新整理
          </button>
          <Link
            href="/book"
            className="rounded-xl bg-[#FFA259] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff8f3d]"
          >
            新預約
          </Link>
        </div>
      </div>

      {toast && (
        <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">
          {toast}
        </div>
      )}

      {state === "loading" && <LoadingList />}

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

      {state === "ready" && bookings.length === 0 && <EmptyState />}

      {state === "ready" && bookings.length > 0 && (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="rounded-2xl bg-white p-5 ring-1 ring-black/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[#4A3B32]">
                      {booking.serviceType}
                    </h2>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="mt-1 text-sm text-[#4A3B32]/70">
                    寵物：{booking.pet?.name ?? "—"}
                  </p>
                  <p className="text-sm text-[#4A3B32]/70">
                    {formatDateTime(booking.startTime)} →{" "}
                    {formatDateTime(booking.endTime)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#4A3B32]">
                    {formatHkd(booking.totalHkd)}
                  </p>
                  {booking.status === "accepted" && (
                    <button
                      type="button"
                      onClick={() => setPayTarget(booking)}
                      className="mt-2 rounded-xl bg-[#FFA259] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff8f3d]"
                    >
                      立即付款
                    </button>
                  )}
                  {booking.status === "verification_pending" && (
                    <span className="mt-2 inline-block text-xs font-medium text-purple-700">
                      已提交付款，等待核對
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailTarget(booking)}
                    className="mt-2 block w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5 sm:ml-auto sm:w-auto"
                  >
                    查看詳情
                  </button>
                </div>
              </div>

              {booking.status === "time_proposed" && (
                <ProposalBanner
                  booking={booking}
                  onResolved={(updated) => {
                    replaceBooking(updated);
                    showToast(
                      updated.status === "accepted"
                        ? "已接受新時間，請完成付款。"
                        : "已拒絕時間建議。",
                    );
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {payTarget && (
        <PayNowModal
          booking={payTarget}
          onClose={() => setPayTarget(null)}
          onPaid={(updated) => {
            replaceBooking(updated);
            setPayTarget(null);
            showToast("已提交付款，等待保姆核對。");
          }}
        />
      )}

      {detailTarget && (
        <BookingDetailModal
          booking={detailTarget}
          onClose={() => setDetailTarget(null)}
          onCancelled={(updated) => {
            replaceBooking(updated);
            setDetailTarget(null);
            showToast("已取消預約。");
          }}
        />
      )}

      {showProfile && (
        <ProfileSettingsModal
          onClose={() => setShowProfile(false)}
          onSaved={(name) => showToast(`已更新個人資料${name ? `（${name}）` : ""}。`)}
        />
      )}
    </section>
  );
}

function LoadingList() {
  return (
    <ul className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="animate-pulse rounded-2xl bg-white p-5 ring-1 ring-black/5"
        >
          <div className="h-4 w-1/3 rounded bg-black/10" />
          <div className="mt-3 h-3 w-2/3 rounded bg-black/5" />
          <div className="mt-2 h-3 w-1/2 rounded bg-black/5" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-black/5">
      <p className="text-4xl" aria-hidden>
        🐾
      </p>
      <p className="mt-3 text-base font-semibold text-[#4A3B32]">
        暫時未有預約
      </p>
      <p className="mt-1 text-sm text-[#4A3B32]/70">
        開始預約你嘅第一個寵物保姆服務。
      </p>
      <Link
        href="/book"
        className="mt-4 inline-block rounded-xl bg-[#FFA259] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#ff8f3d]"
      >
        立即預約
      </Link>
    </div>
  );
}
