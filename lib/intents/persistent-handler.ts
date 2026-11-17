import "server-only";
import { auroraUrl } from "./aurora";
import {
  PERSISTENT_STATUS_TYPES,
  buildPersistentAddressRequest,
  parsePersistentAddress,
  parsePersistentTransfers,
  validatePersistentAddressBody,
  type PersistentStatusType,
} from "./persistent";

/** Minting can wait on 1Click to create the account; Aurora answers 504 itself past its own limit. */
const CREATE_TIMEOUT_MS = 30000;
const READ_TIMEOUT_MS = 8000;
/** Enough for anyone's top-up history on one screen; older deposits are long settled. */
const HISTORY_LIMIT = 50;

export interface PersistentDeps {
  apiKey: string;
  fetchImpl?: typeof fetch;
  ownsWallet: (userId: string, address: string) => Promise<boolean>;
  ownership?: OwnershipCache;
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

const fail = (status: number, error: string): HandlerResult => ({ status, body: { error } });

/**
 * Which addresses were already checked as a user's own, so polling the history
 * does not ask Aurora on every tick. Per server instance and bounded; a miss
 * only costs one lookup.
 */
export class OwnershipCache {
  private readonly owned = new Map<string, true>();
  constructor(private readonly max = 5000) {}

  has(userId: string, address: string): boolean {
    return this.owned.has(`${userId}\n${address}`);
  }

  add(userId: string, address: string): void {
    if (this.owned.size >= this.max) this.owned.delete(this.owned.keys().next().value!);
    this.owned.set(`${userId}\n${address}`, true);
  }
}

const sharedOwnership = new OwnershipCache();

/**
 * Mints (or fetches; Aurora returns the same address for the same inputs) the
 * caller's permanent deposit address. The recipient must be one of the
 * caller's own wallets, as with one-time quotes.
 */
export async function createPersistentAddress(body: unknown, userId: string | null, deps: PersistentDeps): Promise<HandlerResult> {
  const valid = validatePersistentAddressBody(body);
  if (!valid) return fail(400, "Invalid persistent address request");

  if (userId) {
    let owns: boolean;
    try {
      owns = await deps.ownsWallet(userId, valid.recipient);
    } catch {
      return fail(502, "Could not verify wallet");
    }
    if (!owns) return fail(403, "Recipient must be your own wallet");
  }

  let response: Response;
  try {
    response = await (deps.fetchImpl ?? fetch)(auroraUrl("persistent-deposit-address", deps.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPersistentAddressRequest(valid, userId)),
      cache: "no-store",
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    });
  } catch {
    return fail(502, "Could not reach Aurora");
  }

  if (!response.ok) {
    // Only the status: Aurora's message can echo the request, which holds the user's wallet.
    console.error("Aurora refused a persistent deposit address", response.status);
    // 403 means our key may not mint addresses; the user can do nothing about it.
    if (response.status === 403) return fail(503, "Deposits from other networks are not available");
    // 429 is also Aurora's answer while the same address is being minted by a parallel call.
    if (response.status === 429) return fail(429, "Too many requests, try again in a minute");
    return fail(502, "Could not create a deposit address");
  }

  let address;
  try {
    address = parsePersistentAddress(await response.json(), valid.network);
  } catch {
    return fail(502, "Aurora returned no valid deposit address");
  }
  if (userId) (deps.ownership ?? sharedOwnership).add(userId, address.depositAddress);
  return { status: 200, body: address };
}

/** Aurora keeps who each address was minted for; it must be the caller. */
async function ownsPersistentAddress(userId: string, address: string, deps: PersistentDeps): Promise<boolean | "unreachable"> {
  const cache = deps.ownership ?? sharedOwnership;
  if (cache.has(userId, address)) return true;
  try {
    const response = await (deps.fetchImpl ?? fetch)(auroraUrl("persistent-deposit-address-data", deps.apiKey, { address }), {
      cache: "no-store",
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (response.status === 404) return false;
    if (!response.ok) return "unreachable";
    const record = (await response.json()) as { sender?: unknown } | null;
    if (record?.sender !== userId) return false;
  } catch {
    return "unreachable";
  }
  cache.add(userId, address);
  return true;
}

/**
 * Deposits into the address and payouts out of it, for the history on the
 * deposit screen. Only the address's owner may read it: it lists every
 * sender that ever paid into it.
 */
export async function readPersistentHistory(address: string, userId: string | null, deps: PersistentDeps): Promise<HandlerResult> {
  if (userId) {
    const owns = await ownsPersistentAddress(userId, address, deps);
    if (owns === "unreachable") return fail(502, "Could not reach Aurora");
    // 404 either way, so the route does not say whose addresses exist.
    if (!owns) return fail(404, "Unknown deposit address");
  }

  const fetchType = async (type: PersistentStatusType) => {
    const query: Record<string, string> = { address, type };
    if (type === "received") query.limit = String(HISTORY_LIMIT);
    const response = await (deps.fetchImpl ?? fetch)(auroraUrl("persistent-deposit-status", deps.apiKey, query), {
      cache: "no-store",
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Aurora persistent status answered ${response.status}`);
    const body = (await response.json()) as { deposits?: unknown; incomplete?: unknown };
    // Validates the shape; the lists go out as Aurora sent them and the app parses them the same way.
    const { incomplete } = parsePersistentTransfers(body);
    return { deposits: body.deposits as unknown[], incomplete };
  };

  try {
    const [received, success, failed] = await Promise.all(PERSISTENT_STATUS_TYPES.map(fetchType));
    return {
      status: 200,
      body: {
        received: received.deposits,
        success: success.deposits,
        failed: failed.deposits,
        incomplete: received.incomplete || success.incomplete || failed.incomplete,
      },
    };
  } catch (err) {
    console.error("Failed to read persistent deposit history", err instanceof Error ? err.message : "unknown");
    return fail(502, "Could not reach Aurora");
  }
}
