import { isAddress } from "viem";
import { parseAmount } from "./quote";

const USDC_DECIMALS = 6;
/** $5. A typo in the env (e.g. "50" for "0.50") must not be able to drain balances. */
export const MAX_WITHDRAW_FEE = 5_000_000n;
const DEFAULT_FEE_USD = "0.10";

export interface WithdrawFee {
  enabled: boolean;
  /** USDC smallest unit. */
  amount: bigint;
  treasury: `0x${string}` | null;
}

const OFF: WithdrawFee = { enabled: false, amount: 0n, treasury: null };

/**
 * Ruma's own flat fee on withdrawals to other networks. Aurora only takes fees
 * configured per API key, so this one is a second USDC transfer to the
 * treasury. Off unless explicitly enabled with a valid treasury and a sane amount.
 */
export function readWithdrawFee(env: { enabled?: string; amountUsd?: string; treasury?: string }): WithdrawFee {
  if (env.enabled !== "true") return OFF;

  const treasury = env.treasury?.trim();
  if (!treasury || !isAddress(treasury)) {
    console.warn("Withdrawal fee is enabled but NEXT_PUBLIC_RUMA_TREASURY_ADDRESS is not a valid address; charging none.");
    return OFF;
  }

  const amount = parseAmount(env.amountUsd?.trim() || DEFAULT_FEE_USD, USDC_DECIMALS);
  if (amount === null || amount > MAX_WITHDRAW_FEE) {
    console.warn("Withdrawal fee must be above 0 and at most 5 USD; charging none.");
    return OFF;
  }

  return { enabled: true, amount, treasury };
}

// Each variable is spelled out so Next inlines it into the client bundle.
export const WITHDRAW_FEE = readWithdrawFee({
  enabled: process.env.NEXT_PUBLIC_WITHDRAW_FEE_ENABLED,
  amountUsd: process.env.NEXT_PUBLIC_WITHDRAW_FEE_USD,
  treasury: process.env.NEXT_PUBLIC_RUMA_TREASURY_ADDRESS,
});

export function maxWithdrawable(balance: bigint, fee: WithdrawFee): bigint {
  const max = balance - (fee.enabled ? fee.amount : 0n);
  return max > 0n ? max : 0n;
}
