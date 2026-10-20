import type { BookingStatus } from "@/types";

/**
 * Colour-coded status badge for bookings.
 * Pending = Yellow, Accepted = Blue, Paid = Green, Cancelled = Red,
 * with additional shades for time_proposed / completed / rejected.
 */
const STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  accepted: "bg-blue-100 text-blue-800 border-blue-300",
  time_proposed: "bg-indigo-100 text-indigo-800 border-indigo-300",
  paid: "bg-green-100 text-green-800 border-green-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  rejected: "bg-rose-100 text-rose-800 border-rose-300",
};

const LABELS: Record<BookingStatus, string> = {
  pending: "待確認",
  accepted: "已接受",
  time_proposed: "時間待確認",
  paid: "已付款",
  completed: "已完成",
  cancelled: "已取消",
  rejected: "已拒絕",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
