import { isValidNetworkAddress } from "./addresses";
import { isNetworkId, type WithdrawAsset } from "./networks";
import type { WithdrawEstimate } from "./quote";

const DRAFT_KEY = "ruma-withdraw-draft";

/**
 * What the form hands the review screen. Kept in sessionStorage rather than the
 * URL, so a link can never prefill an address or an amount (address-poisoning
 * and phishing links). Read back defensively: the review screen signs from it.
 */
export interface WithdrawDraft {
  asset: WithdrawAsset;
  recipient: string;
  /** USDC smallest unit. */
  amount: string;
  estimate: WithdrawEstimate;
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveDraft(storage: DraftStorage, draft: WithdrawDraft): void {
  storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(storage: DraftStorage): void {
  storage.removeItem(DRAFT_KEY);
}

export function readDraft(storage: DraftStorage): WithdrawDraft | null {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY) ?? "null") as WithdrawDraft | null;
    if (!draft || typeof draft !== "object") return null;
    const { asset, recipient, amount, estimate } = draft;
    const valid =
      asset &&
      typeof asset.assetId === "string" &&
      typeof asset.symbol === "string" &&
      Number.isInteger(asset.decimals) &&
      typeof asset.network === "string" &&
      isNetworkId(asset.network) &&
      typeof recipient === "string" &&
      isValidNetworkAddress(asset.network, recipient) &&
      typeof amount === "string" &&
      /^\d+$/.test(amount) &&
      BigInt(amount) > 0n &&
      estimate &&
      typeof estimate.amountOut === "string" &&
      typeof estimate.minAmountOut === "string" &&
      typeof estimate.amountOutFormatted === "string";
    return valid ? draft : null;
  } catch {
    return null;
  }
}
