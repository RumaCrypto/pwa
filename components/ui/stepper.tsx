import clsx from "clsx";

interface StepperProps {
  current: number;
  total: number;
}

export function Stepper({ current, total }: StepperProps) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={clsx(
            "h-1 w-8 rounded-full transition-colors",
            index < current ? "bg-primary" : "bg-card"
          )}
        />
      ))}
    </div>
  );
}
