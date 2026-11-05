"use client";

import { formatHkd } from "@/components/lib/format";
import type { BookingWithDetails } from "@/types";

interface PriceDisplayProps {
  booking: BookingWithDetails;
  /** Size of the "new" price. */
  size?: "sm" | "lg";
  /** Right-aligns the stack (used in the booking card's price column). */
  align?: "left" | "right";
}

/**
 * Renders the booking total, with the pre-adjustment price struck through and
 * a notice badge when the Owner has changed the price.
 *
 * `previousTotalHkd` is null until an adjustment happens, and the backend only
 * records the ORIGINAL price (not the immediately preceding one), so after two
 * adjustments this shows the first price vs the current one.
 */
export function PriceDisplay({
  booking,
  size = "lg",
  align = "left",
}: PriceDisplayProps) {
  const adjusted =
    booking.previousTotalHkd !== null &&
    booking.previousTotalHkd !== undefined &&
    booking.previousTotalHkd !== booking.totalHkd;

  const alignClass = align === "right" ? "items-end text-right" : "items-start";

  return (
    <div className={`flex flex-col gap-1 ${alignClass}`}>
      {adjusted && (
        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
          保姆已調整價格
        </span>
      )}

      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className={
            size === "lg"
              ? "text-lg font-bold text-text"
              : "text-sm font-bold text-text"
          }
        >
          {formatHkd(booking.totalHkd)}
        </span>
        {adjusted && (
          <span className="text-sm text-gray-400 line-through">
            {formatHkd(booking.previousTotalHkd as number)}
          </span>
        )}
      </div>
    </div>
  );
}
