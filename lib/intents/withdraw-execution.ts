import type { DepositStorage } from "./deposits";
import type { WithdrawFee } from "./fee";
import type { WithdrawAsset } from "./networks";
import { SIGN_MARGIN_MS, type WithdrawQuote, type WithdrawQuoteRequest } from "./quote";
import { WithdrawError } from "./withdraw-errors";
import { saveWithdrawal, updateWithdrawal, withdrawalFromQuote, type IntentWithdrawal } from "./withdrawals";

type Hex = `0x${string}`;

export interface WithdrawDeps {
  storage: DepositStorage;
  now: () => Date;
  /** USDC on Base, read on-chain right before signing. */
  readBalance: () => Promise<bigint>;
  /** USDC `transfer` on Base, signed by the user's wallet; resolves to the tx hash. */
  transfer: (to: Hex, amount: bigint) => Promise<Hex>;
  waitForReceipt: (params: { hash: Hex }) => Promise<{ status: "success" | "reverted" }>;
  submitTx: (hash: string, depositAddress: string) => Promise<void>;
}

/** Walks an error and its causes; viem wraps the useful error several levels deep. */
function someInChain(err: unknown, test: (e: { name?: unknown; code?: unknown }) => boolean): boolean {
  let current: unknown = err;
  for (let depth = 0; current && typeof current === "object" && depth < 10; depth++) {
    if (test(current as { name?: unknown; code?: unknown })) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// Matched by name, not instanceof: pnpm resolves more than one copy of viem.
export function isUserRejection(err: unknown): boolean {
  return someInChain(err, (e) => e.name === "UserRejectedRequestError" || e.code === 4001);
}

const PRE_BROADCAST = new Set(["InsufficientFundsError", "EstimateGasExecutionError", "ContractFunctionExecutionError", "ChainMismatchError"]);

/** Errors viem raises while preparing the transaction, before anything reaches the chain. */
export function failedBeforeBroadcast(err: unknown): boolean {
  return someInChain(err, (e) => typeof e.name === "string" && PRE_BROADCAST.has(e.name));
}

/**
 * Signs and sends a withdrawal. Every check that can stop it runs before the
 * signature, and the record is saved before it too, so whatever happens next
 * (crash, closed tab, lost connection) the track screen can find out from
 * Aurora whether the money left. Only failures known to happen before
 * broadcast are reported as "not sent"; anything uncertain is "unconfirmed".
 */
export async function executeWithdrawal(
  input: { request: WithdrawQuoteRequest; quote: WithdrawQuote; asset: WithdrawAsset; confirmedAmount: bigint; fee: WithdrawFee },
  deps: WithdrawDeps
): Promise<IntentWithdrawal> {
  const { request, quote, asset, confirmedAmount, fee } = input;
  const now = deps.now();

  if (BigInt(quote.amountIn) !== confirmedAmount || request.amount !== confirmedAmount.toString()) {
    throw new WithdrawError("mismatch");
  }
  if (Date.parse(quote.deadline) - now.getTime() < SIGN_MARGIN_MS) throw new WithdrawError("expired");

  const feeAmount = fee.enabled && fee.treasury ? fee.amount : 0n;
  if ((await deps.readBalance()) < confirmedAmount + feeAmount) throw new WithdrawError("balance");

  const address = quote.depositAddress;
  saveWithdrawal(deps.storage, withdrawalFromQuote(quote, asset, request.recipient, now));

  let hash: Hex;
  try {
    hash = await deps.transfer(address as Hex, confirmedAmount);
  } catch (err) {
    if (isUserRejection(err) || failedBeforeBroadcast(err)) {
      updateWithdrawal(deps.storage, address, { phase: "transfer_failed" });
      throw new WithdrawError(isUserRejection(err) ? "rejected" : "reverted");
    }
    console.error("Withdrawal transfer failed in an unknown state", err);
    throw new WithdrawError("unconfirmed");
  }
  updateWithdrawal(deps.storage, address, { transferTxHash: hash });

  let status: "success" | "reverted";
  try {
    ({ status } = await deps.waitForReceipt({ hash }));
  } catch (err) {
    console.error("No receipt for the withdrawal transfer", err);
    throw new WithdrawError("unconfirmed");
  }
  if (status !== "success") {
    updateWithdrawal(deps.storage, address, { phase: "transfer_failed" });
    throw new WithdrawError("reverted");
  }
  const withdrawal = updateWithdrawal(deps.storage, address, { phase: "awaiting_deposit" })!;

  // Neither of these may fail the withdrawal: the USDC is already on its way.
  await deps.submitTx(hash, address).catch((err) => console.error("Could not tell Aurora about the deposit", err));
  if (feeAmount > 0n && fee.treasury) {
    await deps.transfer(fee.treasury, feeAmount).catch((err) => console.error("Ruma withdrawal fee was not charged", err));
  }

  return withdrawal;
}
