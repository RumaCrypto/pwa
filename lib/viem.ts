import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Reads only — no signing — so the chain's default public RPC is enough.
// Set NEXT_PUBLIC_BASE_RPC_URL to point at a dedicated provider if it gets rate-limited.
export const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});
