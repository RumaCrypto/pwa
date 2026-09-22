/**
 * Build-time feature switches. A flag here means the feature is written but the
 * thing behind it does not exist yet, so offering it would be a dead end.
 */
export interface Flags {
  /** No Ruma cash points exist, so cash pickup and payout stay hidden. */
  cashPoints: boolean;
  /** No card issuer is connected, so the card stays a teaser and /card is closed. */
  card: boolean;
}

export const FLAGS: Flags = {
  cashPoints: process.env.NEXT_PUBLIC_FEATURE_CASH_POINTS === "true",
  card: process.env.NEXT_PUBLIC_FEATURE_CARD === "true",
};
