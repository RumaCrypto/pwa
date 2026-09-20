import { createOrders, createLocalStorageRelayStore, type OrdersClient } from "@p2pdotme/sdk/orders";

import { baseClient } from "@/lib/viem";
import { USDC_ADDRESS_BASE } from "@/lib/usdc";

const DIAMOND_ADDRESS = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS as `0x${string}` | undefined;
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_P2P_SUBGRAPH_URL ?? "";

let instance: OrdersClient | null = null;

/**
 * Lazily built so `createLocalStorageRelayStore` — which throws outside a
 * browser — never runs during SSR module evaluation, only on first real use.
 */
export function getP2pOrders(): OrdersClient {
  if (!instance) {
    instance = createOrders({
      publicClient: baseClient,
      diamondAddress: DIAMOND_ADDRESS ?? "0x0000000000000000000000000000000000000000",
      usdcAddress: USDC_ADDRESS_BASE,
      subgraphUrl: SUBGRAPH_URL,
      relayIdentityStore: createLocalStorageRelayStore(),
    });
  }
  return instance;
}
