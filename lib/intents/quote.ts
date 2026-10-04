import { isAddress, parseUnits } from "viem";
import { USDC_BASE_ASSET_ID, type DepositAsset } from "./networks";

/** 1%. People top up from exchanges that shave fees off, so the exact amount rarely arrives. */
export const DEPOSIT_SLIPPAGE_BPS = 100;
/** How long the one-time address accepts a deposit before Aurora starts refunding. */
export const DEPOSIT_WINDOW_MS = 60 * 60 * 1000;
/** The route accepts some clock skew over DEPOSIT_WINDOW_MS, but not addresses that live for days. */
const MAX_DEADLINE_MS = 2 * 60 * 60 * 1000;

export interface QuoteRequest {
  dry: false;
  swapType: "FLEX_INPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  amount: string;
  recipient: string;
  recipientType: "DESTINATION_CHAIN";
  refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS";
  deadline: string;
}

export type RefundMode = "origin" | "intents";
export type Refund = { type: "ORIGIN_CHAIN"; address: string } | { type: "INTENTS" };

/** Origin-chain refunds are the default: they return funds where the user can see them without help. */
export function refundModeFrom(value: string | undefined): RefundMode {
  return value === "intents" ? "intents" : "origin";
}

export interface QuoteResult {
  depositAddress: string;
  /** Only memo chains (e.g. Stellar) set this; none of ours do today. */
  depositMemo?: string;
  amountInFormatted: string;
  minAmountIn: string;
  amountOutFormatted: string;
  minAmountOut: string;
  deadline: string;
  /** Seconds Aurora expects the swap to take once the deposit lands. */
  timeEstimate: number;
}

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

export function parseAmount(text: string, decimals: number): bigint | null {
  const normalised = text.trim().replace(",", ".");
  if (!AMOUNT_PATTERN.test(normalised)) return null;

  const fraction = normalised.split(".")[1] ?? "";
  if (fraction.length > decimals) return null;

  const amount = parseUnits(normalised, decimals);
  return amount > 0n ? amount : null;
}

/**
 * FLEX_INPUT rather than EXACT_INPUT: the amount works as a floor, so a deposit
 * above it (or a little below) still converts instead of being refunded. In
 * intents mode, refunds go to the user's NEAR Intents account, whose implicit
 * id is their EVM address lowercased.
 */
export function buildQuoteRequest({
  asset,
  amount,
  recipient,
  refund,
  now,
}: {
  asset: DepositAsset;
  amount: bigint;
  recipient: `0x${string}`;
  refund: Refund;
  now: Date;
}): QuoteRequest {
  return {
    dry: false,
    swapType: "FLEX_INPUT",
    slippageTolerance: DEPOSIT_SLIPPAGE_BPS,
    originAsset: asset.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: USDC_BASE_ASSET_ID,
    amount: amount.toString(),
    recipient,
    recipientType: "DESTINATION_CHAIN",
    refundTo: refund.type === "INTENTS" ? recipient.toLowerCase() : refund.address.trim(),
    refundType: refund.type,
    deadline: new Date(now.getTime() + DEPOSIT_WINDOW_MS).toISOString(),
  };
}

/**
 * The quote route forwards to Aurora with our API key and fee settings, so it
 * only lets through the one shape this app sends: a deposit that ends as USDC
 * on Base in an EVM address. Returns a fresh object with only the 12 required
 * fields, stripping any extra fields from the input.
 */
export function validateQuoteRequest(body: unknown, mode: RefundMode, now: Date = new Date()): QuoteRequest | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;

  const refundOk =
    mode === "intents"
      ? r.refundType === "INTENTS" && typeof r.recipient === "string" && r.refundTo === r.recipient.toLowerCase()
      : r.refundType === "ORIGIN_CHAIN" && typeof r.refundTo === "string" && r.refundTo.trim() !== "";

  const amountValid = typeof r.amount === "string" && /^\d+$/.test(r.amount) && BigInt(r.amount) > 0n;

  // A past deadline gives an address that is dead on arrival; a far one keeps
  // funds parked with Aurora for longer than the screen promises.
  const deadlineMs = typeof r.deadline === "string" ? Date.parse(r.deadline) : NaN;
  const deadlineValid = deadlineMs > now.getTime() && deadlineMs <= now.getTime() + MAX_DEADLINE_MS;

  const ok =
    r.dry === false &&
    r.swapType === "FLEX_INPUT" &&
    r.depositType === "ORIGIN_CHAIN" &&
    r.destinationAsset === USDC_BASE_ASSET_ID &&
    r.recipientType === "DESTINATION_CHAIN" &&
    refundOk &&
    r.slippageTolerance === DEPOSIT_SLIPPAGE_BPS &&
    typeof r.originAsset === "string" &&
    amountValid &&
    typeof r.recipient === "string" &&
    isAddress(r.recipient) &&
    deadlineValid;

  if (!ok) return null;

  // Return a fresh object with only the 12 QuoteRequest fields, stripping unknowns.
  return {
    dry: false,
    swapType: "FLEX_INPUT",
    slippageTolerance: DEPOSIT_SLIPPAGE_BPS,
    originAsset: r.originAsset as string,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: USDC_BASE_ASSET_ID,
    amount: r.amount as string,
    recipient: r.recipient as string,
    recipientType: "DESTINATION_CHAIN",
    refundTo: r.refundTo as string,
    refundType: r.refundType as "ORIGIN_CHAIN" | "INTENTS",
    deadline: r.deadline as string,
  };
}

export function parseQuoteResponse(body: unknown): QuoteResult {
  const quote = (body as { quote?: Record<string, unknown> } | null)?.quote;
  if (!quote || typeof quote.depositAddress !== "string" || !quote.depositAddress) {
    throw new Error("Aurora returned no deposit address");
  }

  // Anything else malformed would surface as "undefined" or "Invalid Date" on
  // the deposit screen, or crash it, so it fails here with a clear reason.
  for (const field of ["amountInFormatted", "minAmountIn", "amountOutFormatted", "minAmountOut"] as const) {
    if (typeof quote[field] !== "string") throw new Error(`Aurora returned no ${field}`);
  }
  if (typeof quote.deadline !== "string" || Number.isNaN(Date.parse(quote.deadline))) {
    throw new Error("Aurora returned an invalid deadline");
  }
  if (typeof quote.timeEstimate !== "number" || !Number.isFinite(quote.timeEstimate)) {
    throw new Error("Aurora returned an invalid timeEstimate");
  }

  return {
    depositAddress: quote.depositAddress,
    depositMemo: typeof quote.depositMemo === "string" ? quote.depositMemo : undefined,
    amountInFormatted: quote.amountInFormatted as string,
    minAmountIn: quote.minAmountIn as string,
    amountOutFormatted: quote.amountOutFormatted as string,
    minAmountOut: quote.minAmountOut as string,
    deadline: quote.deadline,
    timeEstimate: quote.timeEstimate,
  };
}
