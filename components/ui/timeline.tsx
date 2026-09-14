import type { ReactNode } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

export type TimelineStepState = "done" | "current" | "pending";

export interface TimelineStep {
  title: ReactNode;
  subtitle?: ReactNode;
  state: TimelineStepState;
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              style={typography.label4}
              className={clsx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                step.state === "done" && "bg-primary text-white",
                step.state === "current" && "bg-black text-white",
                step.state === "pending" && "bg-card text-text-secondary"
              )}
            >
              {step.state === "done" ? <Check size={14} /> : index + 1}
            </span>
            {index < steps.length - 1 && <span className="w-px flex-1 bg-border-light" />}
          </div>

          <div className={clsx("pb-5", index === steps.length - 1 && "pb-0")}>
            <p
              style={typography.heading4}
              className={clsx(step.state === "pending" && "text-text-secondary")}
            >
              {step.title}
            </p>
            {step.subtitle && (
              <p style={typography.body3} className="mt-0.5 text-text-secondary">
                {step.subtitle}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
