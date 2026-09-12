import clsx from "clsx";
import { typography } from "@/constants/typography";

interface PaymentCardProps {
  last4: string;
  /** Shown above the number, such as the cardholder name. */
  holder?: string;
  /** "Debit" / "Débito", already translated by the caller. */
  kind?: string;
  expiry?: string;
  className?: string;
}

export function PaymentCard({ last4, holder, kind, expiry, className }: PaymentCardProps) {
  return (
    <div className={clsx("flex flex-col justify-between rounded-3xl bg-black px-6 py-6 text-white", className)}>
      <div className="flex items-start justify-between">
        <span className="h-6 w-10 rounded bg-primary" aria-hidden />
        {kind && (
          <span style={typography.label4} className="text-white/60">
            {kind}
          </span>
        )}
      </div>

      {(holder || expiry) && (
        <div className="mt-8">
          {holder && (
            <p style={typography.label3} className="uppercase">
              {holder}
            </p>
          )}
          {expiry && (
            <p style={typography.label5} className="mt-0.5 font-mono text-white/50">
              {expiry}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex items-end justify-between">
        <span style={typography.heading3} className="font-mono tracking-widest">
          ···· ···· ···· {last4}
        </span>
        <span style={typography.heading3} className="italic">
          VISA
        </span>
      </div>
    </div>
  );
}
