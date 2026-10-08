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

export interface WithdrawAsset extends DepositAsset {
  network: NetworkId;
  /** Lets the server refuse a token contract as a recipient. */
  contractAddress: string | null;
}

/**
 * Per network, the assets worth offering for deposits, in display order. The token list
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

/**
 * What a withdrawal can arrive as. Only stablecoins, plus BTC where no dollar
 * token exists: someone cashing out of a dollar account expects dollars.
 */
const WITHDRAW_SYMBOLS: Record<NetworkId, readonly string[]> = {
  eth: ["USDC", "USDT"],
  arb: ["USDC", "USDT"],
  op: ["USDC", "USDT"],
  tron: ["USDT"],
  btc: ["BTC"],
  near: ["USDC", "USDT"],
};

const DISPLAY_SYMBOL: Record<string, string> = { wNEAR: "NEAR" };

/**
 * Aurora's token endpoint answers { asset_stats, tokens }; a bare array is also
 * accepted so the client and server parse the list the same way.
 */
export function tokenList(body: unknown): IntentsToken[] | null {
  const list = Array.isArray(body) ? body : (body as { tokens?: unknown } | null)?.tokens;
  return Array.isArray(list) ? (list as IntentsToken[]) : null;
}

export function isNetworkId(value: string): value is NetworkId {
  return NETWORKS.some((network) => network.id === value);
}

export function findNetwork(id: NetworkId): Network {
  return NETWORKS.find((network) => network.id === id)!;
}

function pickTokens(tokens: readonly IntentsToken[], network: NetworkId, symbols: readonly string[]): IntentsToken[] {
  const picked: IntentsToken[] = [];
  for (const symbol of symbols) {
    // The first listing wins when a symbol appears twice on one chain.
    const token = tokens.find((t) => t.blockchain === network && t.symbol === symbol);
    if (token) picked.push(token);
  }
  return picked;
}

export function assetsForNetwork(tokens: readonly IntentsToken[], network: NetworkId): DepositAsset[] {
  return pickTokens(tokens, network, ALLOWED_SYMBOLS[network]).map((token) => ({
    assetId: token.assetId,
    symbol: DISPLAY_SYMBOL[token.symbol] ?? token.symbol,
    decimals: token.decimals,
    priceUsd: token.price,
  }));
}

export function withdrawAssetsForNetwork(tokens: readonly IntentsToken[], network: NetworkId): WithdrawAsset[] {
  return pickTokens(tokens, network, WITHDRAW_SYMBOLS[network]).map((token) => ({
    assetId: token.assetId,
    symbol: token.symbol,
    decimals: token.decimals,
    priceUsd: token.price,
    network,
    contractAddress: token.contractAddress,
  }));
}

/** The server's allow-list for a withdrawal's destination, derived from Aurora's own token list. */
export function allWithdrawAssets(tokens: readonly IntentsToken[]): WithdrawAsset[] {
  return NETWORKS.flatMap((network) => withdrawAssetsForNetwork(tokens, network.id));
}
