export const INTENT_STATUSES = [
  "PENDING_DEPOSIT",
  "KNOWN_DEPOSIT_TX",
  "PROCESSING",
  "SUCCESS",
  "INCOMPLETE_DEPOSIT",
  "REFUNDED",
  "FAILED",
] as const;

export type IntentStatus = (typeof INTENT_STATUSES)[number];

export type DepositPhase = "awaiting_deposit" | "incomplete" | "processing" | "completed" | "refunded" | "failed";

const PHASES: Record<IntentStatus, DepositPhase> = {
  PENDING_DEPOSIT: "awaiting_deposit",
  // Less than the minimum arrived. FLEX_INPUT keeps the address open until the
  // deadline, so a top-up can still complete it.
  INCOMPLETE_DEPOSIT: "incomplete",
  KNOWN_DEPOSIT_TX: "processing",
  PROCESSING: "processing",
  SUCCESS: "completed",
  REFUNDED: "refunded",
  FAILED: "failed",
};

export function phaseFor(status: IntentStatus): DepositPhase {
  return PHASES[status];
}

export function isTerminal(phase: DepositPhase): boolean {
  return phase === "completed" || phase === "refunded" || phase === "failed";
}

export interface StatusResult {
  status: IntentStatus;
  /** USDC that reached Base, as Aurora formats it. Set once settled. */
  receivedFormatted?: string;
  destinationTxHash?: string;
}

function isIntentStatus(value: unknown): value is IntentStatus {
  return typeof value === "string" && (INTENT_STATUSES as readonly string[]).includes(value);
}

export function parseStatusResponse(body: unknown): StatusResult {
  const data = (body ?? {}) as {
    status?: unknown;
    swapDetails?: { amountOutFormatted?: unknown; destinationChainTxHashes?: { hash?: unknown }[] };
  };
  if (!isIntentStatus(data.status)) throw new Error(`Unknown Aurora status: ${String(data.status)}`);

  const result: StatusResult = { status: data.status };
  const received = data.swapDetails?.amountOutFormatted;
  if (typeof received === "string") result.receivedFormatted = received;
  const hash = data.swapDetails?.destinationChainTxHashes?.[0]?.hash;
  if (typeof hash === "string") result.destinationTxHash = hash;
  return result;
}
