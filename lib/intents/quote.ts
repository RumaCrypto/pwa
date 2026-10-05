import { getAddress, isAddress, parseUnits } from "viem";
import { USDC_BASE_ASSET_ID, type DepositAsset, type WithdrawAsset } from "./networks";
import { isValidNetworkAddress } from "./addresses";
import { WithdrawError } from "./withdraw-errors";

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

/** 1%. Shown to the user as the guaranteed minimum on the review screen. */
export const WITHDRAW_SLIPPAGE_BPS = 100;
/** The transfer is signed seconds after quoting; half an hour covers a slow wallet prompt. */
export const WITHDRAW_WINDOW_MS = 30 * 60 * 1000;
/** Below this the transfer could land after the deadline and bounce back as a refund. */
export const SIGN_MARGIN_MS = 5 * 60 * 1000;

export interface WithdrawQuoteRequest {
  dry: boolean;
  swapType: "EXACT_INPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  amount: string;
  recipient: string;
  recipientType: "DESTINATION_CHAIN";
  refundTo: string;
  refundType: "ORIGIN_CHAIN";
  deadline: string;
}

/**
 * EXACT_INPUT: the user picks how much leaves their balance, so it can never
 * exceed it; what arrives floats with the market, within the slippage. A failed
 * conversion refunds to their own Base wallet, so it lands back in the balance.
 */
export function buildWithdrawQuoteRequest({
  asset,
  amount,
  recipient,
  refundTo,
  dry,
  now,
}: {
  asset: WithdrawAsset;
  amount: bigint;
  recipient: string;
  refundTo: `0x${string}`;
  dry: boolean;
  now: Date;
}): WithdrawQuoteRequest {
  return {
    dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: WITHDRAW_SLIPPAGE_BPS,
    originAsset: USDC_BASE_ASSET_ID,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: asset.assetId,
    amount: amount.toString(),
    recipient: recipient.trim(),
    recipientType: "DESTINATION_CHAIN",
    refundTo,
    refundType: "ORIGIN_CHAIN",
    deadline: new Date(now.getTime() + WITHDRAW_WINDOW_MS).toISOString(),
  };
}

/** Deposits end in USDC on Base; withdrawals start there. */
export function isWithdrawalBody(body: unknown): boolean {
  return typeof body === "object" && body !== null && (body as { originAsset?: unknown }).originAsset === USDC_BASE_ASSET_ID;
}

/**
 * The only withdrawal shape the quote route forwards: USDC on Base out to one
 * of the allowed assets, at a valid address on that asset's network, refunded
 * to an EVM address (the route then checks it is the caller's). Returns a
 * fresh object, so nothing extra (e.g. appFees) reaches Aurora on our key.
 */
export function validateWithdrawQuoteRequest(
  body: unknown,
  allowed: readonly WithdrawAsset[],
  now: Date = new Date()
): { request: WithdrawQuoteRequest; asset: WithdrawAsset } | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;

  const asset = allowed.find((a) => a.assetId === r.destinationAsset);
  if (!asset) return null;

  const deadlineMs = typeof r.deadline === "string" ? Date.parse(r.deadline) : NaN;
  const ok =
    typeof r.dry === "boolean" &&
    r.swapType === "EXACT_INPUT" &&
    r.slippageTolerance === WITHDRAW_SLIPPAGE_BPS &&
    r.originAsset === USDC_BASE_ASSET_ID &&
    r.depositType === "ORIGIN_CHAIN" &&
    typeof r.amount === "string" &&
    /^\d+$/.test(r.amount) &&
    BigInt(r.amount) > 0n &&
    typeof r.recipient === "string" &&
    r.recipient === r.recipient.trim() &&
    isValidNetworkAddress(asset.network, r.recipient) &&
    r.recipientType === "DESTINATION_CHAIN" &&
    r.refundType === "ORIGIN_CHAIN" &&
    typeof r.refundTo === "string" &&
    isAddress(r.refundTo) &&
    deadlineMs > now.getTime() &&
    deadlineMs <= now.getTime() + MAX_DEADLINE_MS;
  if (!ok) return null;

  return {
    asset,
    request: {
      dry: r.dry as boolean,
      swapType: "EXACT_INPUT",
      slippageTolerance: WITHDRAW_SLIPPAGE_BPS,
      originAsset: USDC_BASE_ASSET_ID,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: asset.assetId,
      amount: r.amount as string,
      recipient: r.recipient as string,
      recipientType: "DESTINATION_CHAIN",
      refundTo: r.refundTo as string,
      refundType: "ORIGIN_CHAIN",
      deadline: r.deadline as string,
    },
  };
}

export interface WithdrawEstimate {
  /** Smallest unit of the destination asset. */
  amountOut: string;
  amountOutFormatted: string;
  /** Smallest unit; what slippage still guarantees. */
  minAmountOut: string;
  amountInUsd?: string;
  amountOutUsd?: string;
  timeEstimate: number;
}

export interface WithdrawQuote extends WithdrawEstimate {
  depositAddress: string;
  /** Smallest unit of USDC; exactly what gets signed. */
  amountIn: string;
  amountInFormatted: string;
  deadline: string;
}

function quoteObject(body: unknown): Record<string, unknown> {
  const quote = (body as { quote?: unknown } | null)?.quote;
  if (!quote || typeof quote !== "object") throw new Error("Aurora returned no quote");
  return quote as Record<string, unknown>;
}

/** Dry quotes carry no address or deadline (Aurora's docs), only the price. */
export function parseWithdrawEstimate(body: unknown): WithdrawEstimate {
  const quote = quoteObject(body);
  for (const field of ["amountOut", "amountOutFormatted", "minAmountOut"] as const) {
    if (typeof quote[field] !== "string") throw new Error(`Aurora returned no ${field}`);
  }
  // These feed BigInt() later; a non-integer would throw there or compare wrongly.
  for (const field of ["amountOut", "minAmountOut"] as const) {
    if (!/^\d+$/.test(quote[field] as string)) throw new Error(`Aurora returned an invalid ${field}`);
  }
  if (typeof quote.timeEstimate !== "number" || !Number.isFinite(quote.timeEstimate)) {
    throw new Error("Aurora returned an invalid timeEstimate");
  }
  const estimate: WithdrawEstimate = {
    amountOut: quote.amountOut as string,
    amountOutFormatted: quote.amountOutFormatted as string,
    minAmountOut: quote.minAmountOut as string,
    timeEstimate: quote.timeEstimate,
  };
  if (typeof quote.amountInUsd === "string") estimate.amountInUsd = quote.amountInUsd;
  if (typeof quote.amountOutUsd === "string") estimate.amountOutUsd = quote.amountOutUsd;
  return estimate;
}

const ECHOED_FIELDS = ["originAsset", "destinationAsset", "amount", "recipient", "refundTo"] as const;

function sameEvmAddress(a: unknown, b: string): boolean {
  if (typeof a !== "string") return false;
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return false;
  }
}

/**
 * Aurora may echo an EVM address in another case (e.g. checksummed), which is
 * the same address; everything else must match exactly.
 */
function echoMatches(field: (typeof ECHOED_FIELDS)[number], echoed: unknown, sent: WithdrawQuoteRequest): boolean {
  const isEvmField = field === "refundTo" || (field === "recipient" && isAddress(sent.recipient));
  return isEvmField ? sameEvmAddress(echoed, sent[field]) : echoed === sent[field];
}

/**
 * The live quote decides where the user's money goes, so before anything is
 * signed it must be for exactly what was asked: Aurora echoes the request, and
 * every field that moves money is compared. Any difference stops the
 * withdrawal rather than signing something the user did not review.
 */
export function parseWithdrawQuote(body: unknown, sent: WithdrawQuoteRequest): WithdrawQuote {
  const echoed = (body as { quoteRequest?: Record<string, unknown> } | null)?.quoteRequest;
  if (!echoed || ECHOED_FIELDS.some((field) => !echoMatches(field, echoed[field], sent))) throw new WithdrawError("mismatch");

  const estimate = parseWithdrawEstimate(body);
  const quote = quoteObject(body);
  if (typeof quote.depositAddress !== "string" || !isAddress(quote.depositAddress)) throw new WithdrawError("mismatch");
  if (typeof quote.amountIn !== "string" || !/^\d+$/.test(quote.amountIn) || quote.amountIn !== sent.amount) throw new WithdrawError("mismatch");
  if (typeof quote.amountInFormatted !== "string") throw new Error("Aurora returned no amountInFormatted");
  if (typeof quote.deadline !== "string" || Number.isNaN(Date.parse(quote.deadline))) {
    throw new Error("Aurora returned an invalid deadline");
  }

  return {
    ...estimate,
    depositAddress: quote.depositAddress,
    amountIn: quote.amountIn,
    amountInFormatted: quote.amountInFormatted,
    deadline: quote.deadline,
  };
}

/**
 * The live quote is fetched on confirm, a moment after the user read the
 * estimate. It is signed without asking again only if the minimum it now
 * enforces is at least the "Guaranteed minimum" the user read.
 */
export function quoteStillHolds(shown: WithdrawEstimate, quote: WithdrawQuote): boolean {
  return BigInt(quote.minAmountOut) >= BigInt(shown.minAmountOut);
}

/** Network and conversion cost in dollars, as Aurora prices both sides. Null when it did not say. */
export function conversionCostUsd(estimate: WithdrawEstimate): string | null {
  if (estimate.amountInUsd === undefined || estimate.amountOutUsd === undefined) return null;
  const cost = Number(estimate.amountInUsd) - Number(estimate.amountOutUsd);
  if (!Number.isFinite(cost)) return null;
  return Math.max(0, cost).toFixed(2);
}
