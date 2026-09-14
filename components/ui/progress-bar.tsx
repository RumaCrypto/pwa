import clsx from "clsx";

interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  /** "onDark" for the navy status cards, where the track is translucent white. */
  tone?: "default" | "onDark";
  className?: string;
}

export function ProgressBar({ value, tone = "default", className }: ProgressBarProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={clsx(
        "h-1.5 w-full overflow-hidden rounded-full",
        tone === "onDark" ? "bg-white/25" : "bg-card",
        className
      )}
    >
      <div
        style={{ width: `${percent}%` }}
        className={clsx("h-full rounded-full transition-all", tone === "onDark" ? "bg-white" : "bg-primary")}
      />
    </div>
  );
}
