import { chunkAddress } from "@/lib/format";

/**
 * The whole address, in groups of four, with the first and last groups
 * emphasised: address poisoning forges look-alikes that only match there,
 * so reading the middle too is what catches them.
 */
export function AddressChunks({ address }: { address: string }) {
  const chunks = chunkAddress(address);
  return (
    <p className="flex flex-wrap gap-x-1.5 gap-y-1 font-mono text-sm break-all">
      {chunks.map((chunk, i) => (
        <span key={i} className={i === 0 || i === chunks.length - 1 ? "font-semibold text-text-primary" : "text-text-secondary"}>
          {chunk}
        </span>
      ))}
    </p>
  );
}
