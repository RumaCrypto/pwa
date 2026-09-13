import { USDC_ADDRESS_BASE } from "@/lib/usdc";

/**
 * Everything `@p2pdotme/sdk` needs before it can be instantiated. Nothing here
 * is wired up yet: the module exists so the configuration surface is explicit
 * and its absence is detectable, rather than discovered at the first call.
 *
 * The SDK reads no environment variables of its own — all config is passed to
 * its factory functions — so this is the only place these values are collected.
 */
export interface P2pConfig {
  /** Diamond proxy holding the order facets, on Base. */
  diamondAddress: string;
  usdcAddress: string;
  /** GraphQL endpoint backing order history reads. */
  subgraphUrl: string;
  /** Only needed to enable the zkKYC module, which raises transaction limits. */
  reputationManagerAddress?: string;
  /** Only needed to enable the fraud engine. */
  fraudEngine?: { apiUrl: string; encryptionKey: string };
}

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

const DIAMOND = read("NEXT_PUBLIC_P2P_DIAMOND_ADDRESS");
const SUBGRAPH = read("NEXT_PUBLIC_P2P_SUBGRAPH_URL");
const REPUTATION = read("NEXT_PUBLIC_P2P_REPUTATION_MANAGER_ADDRESS");
const FRAUD_API = read("NEXT_PUBLIC_P2P_FRAUD_API_URL");
const FRAUD_KEY = read("NEXT_PUBLIC_P2P_FRAUD_ENCRYPTION_KEY");

/** Null until the required values are present, so callers must handle absence. */
export function p2pConfig(): P2pConfig | null {
  if (!DIAMOND || !SUBGRAPH) return null;

  return {
    diamondAddress: DIAMOND,
    usdcAddress: USDC_ADDRESS_BASE,
    subgraphUrl: SUBGRAPH,
    reputationManagerAddress: REPUTATION,
    fraudEngine: FRAUD_API && FRAUD_KEY ? { apiUrl: FRAUD_API, encryptionKey: FRAUD_KEY } : undefined,
  };
}

export function isP2pConfigured(): boolean {
  return p2pConfig() !== null;
}

/** Names the values still missing, for a setup screen or a startup warning. */
export function missingP2pConfig(): string[] {
  const missing: string[] = [];
  if (!DIAMOND) missing.push("NEXT_PUBLIC_P2P_DIAMOND_ADDRESS");
  if (!SUBGRAPH) missing.push("NEXT_PUBLIC_P2P_SUBGRAPH_URL");
  return missing;
}
