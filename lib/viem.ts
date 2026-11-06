import { createPublicClient, http } from "viem";
import { base, mainnet } from "viem/chains";

// Reads only — no signing — so the chain's default public RPC is enough.
// Set NEXT_PUBLIC_BASE_RPC_URL to point at a dedicated provider if it gets rate-limited.
export const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});

// Usernames live in ENS on Ethereum mainnet. Same deal as Base: reads only,
// and NEXT_PUBLIC_MAINNET_RPC_URL replaces the public RPC when it rate-limits.
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
});
