import clsx from "clsx";
import { typography } from "@/constants/typography";

interface NetworkLike {
  name: string;
  logo: string;
}

export function NetworkLogo({ network, size = 28, className }: { network: NetworkLike; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs; next/image adds nothing here.
    <img
      src={network.logo}
      alt={network.name}
      width={size}
      height={size}
      className={clsx("shrink-0 rounded-full bg-white", className)}
    />
  );
}

/** Overlapping logos, so one option can promise several networks at a glance. */
export function NetworkLogoStack({ networks, max = 6 }: { networks: readonly NetworkLike[]; max?: number }) {
  const shown = networks.slice(0, max);
  const rest = networks.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((network, i) => (
        <NetworkLogo key={network.name} network={network} size={24} className={clsx("ring-2 ring-white", i > 0 && "-ml-2")} />
      ))}
      {rest > 0 && (
        <span style={typography.label5} className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-card ring-2 ring-white">
          +{rest}
        </span>
      )}
    </span>
  );
}
