"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Max width utility, e.g. "max-w-md" | "max-w-lg". */
  maxWidth?: string;
}

/**
 * Accessible-ish modal: closes on backdrop click and Escape, locks scroll.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-[#4A3B32]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="rounded-lg p-1 text-[#4A3B32]/60 hover:bg-black/5"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
