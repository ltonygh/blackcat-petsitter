/** Shared formatting helpers for the dashboards (HK locale, zh-HK). */

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatHkd(amount: number): string {
  return `HK$${amount.toLocaleString("en-HK")}`;
}

/**
 * Convert a date (YYYY-MM-DD) + time (HH:mm) pair into an ISO string.
 * Returns null if either part is missing/invalid.
 */
export function toIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null;
  const time = timeStr || "00:00";
  const d = new Date(`${dateStr}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Extract "HH:mm" from an ISO string, for prefilling <input type=time>. */
export function isoToTimePart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Extract "YYYY-MM-DD" from an ISO string, for prefilling <input type=date>. */
export function isoToDatePart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
