"use client";

export interface StepperStep {
  id: number;
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  /** 1-based index of the current step. */
  current: number;
}

/**
 * Horizontal progress stepper for the booking wizard.
 * Completed steps are shown in golden, the active step in primary orange,
 * and upcoming steps muted.
 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex w-full items-center">
      {steps.map((step, index) => {
        const isDone = step.id < current;
        const isActive = step.id === current;

        return (
          <li
            key={step.id}
            className={`flex items-center ${
              index < steps.length - 1 ? "flex-1" : ""
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  isDone
                    ? "bg-[#FFCB56] text-[#4A3B32]"
                    : isActive
                      ? "bg-[#FFA259] text-white"
                      : "bg-white text-[#4A3B32]/50 ring-1 ring-black/10"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? "✓" : step.id}
              </span>
              <span
                className={`whitespace-nowrap text-xs font-medium ${
                  isActive ? "text-[#4A3B32]" : "text-[#4A3B32]/60"
                }`}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`mx-2 h-0.5 flex-1 rounded ${
                  isDone ? "bg-[#FFCB56]" : "bg-black/10"
                }`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
