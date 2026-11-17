/**
 * Levels are a user-facing summary of the Reputation Points (RP) p2p.me's
 * Reputation Manager has credited to a wallet. RP is never shown as such:
 * the user sees a level and the per-order limits the diamond reports.
 *
 * A BUY limit is RP × the corridor's USDC-per-RP multiplier (1 RP = 2 USDC
 * outside India), so a wallet's RP is recovered from its on-chain buy limit.
 * The top of the scale, 300 RP, is what lifts the buy limit to $600.
 */
export const MAX_RP = 300;

/** Minimum RP for levels 1..4. Level 0 is a wallet with no RP at all. */
export const LEVEL_THRESHOLDS = [1, 100, 200, MAX_RP] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function levelForRp(rp: number): number {
  let level = 0;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (rp >= threshold) level += 1;
  }
  return level;
}

/** RP behind a buy limit, given the corridor's USDC granted per RP. */
export function rpFromBuyLimit(buyLimitUsdc: number, usdcPerRp: number): number {
  if (!(usdcPerRp > 0) || !(buyLimitUsdc > 0)) return 0;
  return Math.round(buyLimitUsdc / usdcPerRp);
}
