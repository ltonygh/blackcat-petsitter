"use client";

import { useEffect, useRef, useState } from "react";

export interface MultiSelectOption {
  id: string;
  label: string;
  /** Display price, e.g. "+$30". Omitted for the 無添加 option. */
  priceLabel?: string;
}

interface MultiSelectPopoverProps {
  options: MultiSelectOption[];
  /** Currently selected option ids. Empty = 無添加. */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Text shown on the trigger when nothing is selected. */
  emptyLabel?: string;
  /** Accessible label for the trigger (e.g. "第 2 天附加服務"). */
  ariaLabel: string;
}

/**
 * Checkbox dropdown with a floating panel. Built instead of `<select multiple>`
 * because that control is unusable on touch devices.
 *
 * Selecting 無添加 clears everything; selecting any real option clears 無添加,
 * so "none" and "some" can never both be true.
 */
export function MultiSelectPopover({
  options,
  selected,
  onChange,
  emptyLabel = "無添加",
  ariaLabel,
}: MultiSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + Escape close.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full max-w-full min-w-0 items-start justify-between gap-2 overflow-hidden rounded-xl border border-black/10 bg-surface px-3 py-2 text-left text-sm text-text outline-none transition-colors hover:bg-surface-hover focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        {/* Selected items, one per line. */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-1 overflow-hidden">
          {selected.length === 0 ? (
            <span className="block w-full truncate text-text/50">
              {emptyLabel || "無添加"}
            </span>
          ) : (
            options
              .filter((opt) => selected.includes(opt.id))
              .map((opt) => (
                <span key={opt.id} className="block w-full truncate">
                  {opt.label}
                </span>
              ))
          )}
        </div>

        {/* Dropdown arrow */}
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 text-xs text-text/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          role="group"
          aria-label={ariaLabel}
          className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-black/10 bg-surface shadow-lg"
        >
          <ul className="max-h-64 overflow-y-auto p-1">
            <li>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-text hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={selected.length === 0}
                  onChange={clearAll}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span className="font-medium">{emptyLabel}</span>
              </label>
            </li>
            {options.map((opt) => (
              <li key={opt.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-text hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">{opt.label}</span>
                  {opt.priceLabel && (
                    <span className="shrink-0 text-xs text-text/60">
                      {opt.priceLabel}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
