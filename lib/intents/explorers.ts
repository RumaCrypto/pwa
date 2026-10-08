import type { NetworkId } from "./networks";

const EVM_HASH = /^0x[0-9a-fA-F]{64}$/;
const HEX_HASH = /^[0-9a-fA-F]{64}$/;
const NEAR_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

/**
 * Explorer links are built from a fixed base and a hash that must look like
 * one. Aurora also returns explorer URLs, but they are never used: data from
 * outside must not decide where a link in the app points.
 */
export function explorerTxUrl(network: NetworkId, hash: string): string | null {
  switch (network) {
    case "eth":
      return EVM_HASH.test(hash) ? `https://etherscan.io/tx/${hash}` : null;
    case "arb":
      return EVM_HASH.test(hash) ? `https://arbiscan.io/tx/${hash}` : null;
    case "op":
      return EVM_HASH.test(hash) ? `https://optimistic.etherscan.io/tx/${hash}` : null;
    case "tron": {
      const bare = hash.startsWith("0x") ? hash.slice(2) : hash;
      return HEX_HASH.test(bare) ? `https://tronscan.org/#/transaction/${bare}` : null;
    }
    case "btc":
      return HEX_HASH.test(hash) ? `https://mempool.space/tx/${hash}` : null;
    case "near":
      return NEAR_HASH.test(hash) ? `https://nearblocks.io/txns/${hash}` : null;
  }
}

/** The USDC transfer that starts every withdrawal happens on Base. */
export function baseTxUrl(hash: string): string | null {
  return EVM_HASH.test(hash) ? `https://basescan.org/tx/${hash}` : null;
}
