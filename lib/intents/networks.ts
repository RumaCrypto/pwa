/**
 * Where a deposit can come from. Aurora Intents supports many more chains;
 * these are the ones the designs promise, kept short so the picker stays
 * scannable. Base is not here: USDC on Base needs no conversion and has its
 * own option that shows the user's address directly.
 */
export type NetworkId = "eth" | "arb" | "op" | "tron" | "btc" | "near";

export interface Network {
  id: NetworkId;
  name: string;
  logo: string;
}

export const NETWORKS: readonly Network[] = [
  { id: "eth", name: "Ethereum", logo: "/networks/eth.svg" },
  { id: "arb", name: "Arbitrum", logo: "/networks/arb.svg" },
  { id: "op", name: "Optimism", logo: "/networks/op.svg" },
  { id: "tron", name: "Tron", logo: "/networks/tron.svg" },
  { id: "btc", name: "Bitcoin", logo: "/networks/btc.svg" },
  { id: "near", name: "NEAR", logo: "/networks/near.svg" },
];

export const BASE_NETWORK = { id: "base", name: "Base", logo: "/networks/base.svg" } as const;

/** Native USDC on Base, as NEAR Intents names it. Every deposit settles here. */
export const USDC_BASE_ASSET_ID = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";

/** One entry of Aurora's `GET /api/tokens/{apiKey}`. */
export interface IntentsToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price: number;
  contractAddress: string | null;
}

export interface DepositAsset {
  assetId: string;
  /** What the user sees, e.g. "NEAR" for wNEAR. */
  symbol: string;
  decimals: number;
  priceUsd: number;
}

/**
 * Per network, the assets worth offering, in display order. The token list
 * also carries long-tail and bridged assets (BTC on NEAR, memecoins) that would
 * only confuse someone topping up a dollar account.
 */
const ALLOWED_SYMBOLS: Record<NetworkId, readonly string[]> = {
  eth: ["USDC", "USDT", "ETH"],
  arb: ["USDC", "USDT", "ETH"],
  op: ["USDC", "USDT", "ETH"],
  tron: ["USDT", "TRX"],
  btc: ["BTC"],
  near: ["USDC", "USDT", "wNEAR"],
};

const DISPLAY_SYMBOL: Record<string, string> = { wNEAR: "NEAR" };

export function isNetworkId(value: string): value is NetworkId {
  return NETWORKS.some((network) => network.id === value);
}

export function findNetwork(id: NetworkId): Network {
  return NETWORKS.find((network) => network.id === id)!;
}

export function assetsForNetwork(tokens: readonly IntentsToken[], network: NetworkId): DepositAsset[] {
  const allowed = ALLOWED_SYMBOLS[network];
  const assets: DepositAsset[] = [];

  for (const symbol of allowed) {
    // The first listing wins when a symbol appears twice on one chain.
    const token = tokens.find((t) => t.blockchain === network && t.symbol === symbol);
    if (!token) continue;
    assets.push({
      assetId: token.assetId,
      symbol: DISPLAY_SYMBOL[symbol] ?? symbol,
      decimals: token.decimals,
      priceUsd: token.price,
    });
  }

  return assets;
}
