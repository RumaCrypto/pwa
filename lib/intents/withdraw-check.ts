import { isNamedNearAccount } from "./addresses";
import { allWithdrawAssets, type IntentsToken } from "./networks";
import { validateWithdrawQuoteRequest, type WithdrawQuoteRequest } from "./quote";

export type WithdrawCheck = { ok: true; request: WithdrawQuoteRequest } | { ok: false; status: number; error: string };

const refuse = (status: number, error: string): WithdrawCheck => ({ ok: false, status, error });

/**
 * Everything the server decides about a withdrawal quote before spending our
 * Aurora key on it. The recipient is a stranger's address by design, so what
 * ties the request to the caller is the refund: it must go back to one of
 * their own wallets. Lookups (tokens, Privy, NEAR) are injected for tests and
 * may throw; the route turns that into a 502.
 */
export async function checkWithdrawRequest(
  body: unknown,
  deps: {
    userId: string | null;
    dry: boolean;
    tokens: () => Promise<IntentsToken[]>;
    ownsWallet: (userId: string, address: string) => Promise<boolean>;
    nearAccountExists: (accountId: string) => Promise<boolean>;
    now?: Date;
  }
): Promise<WithdrawCheck> {
  // Even with INTENTS_AUTH_REQUIRED=false: without a user there is no way to tie the refund to anyone.
  if (!deps.userId) return refuse(401, "Sign in required");

  const tokens = await deps.tokens();
  const validated = validateWithdrawQuoteRequest(body, allWithdrawAssets(tokens), deps.now);
  if (!validated || validated.request.dry !== deps.dry) return refuse(400, "Invalid quote request");
  const { request, asset } = validated;

  if (!(await deps.ownsWallet(deps.userId, request.refundTo))) return refuse(403, "Refunds must go to your own wallet");

  const recipient = request.recipient.toLowerCase();
  if (recipient === request.refundTo.toLowerCase()) return refuse(422, "Recipient is your own wallet");
  if (tokens.some((t) => t.contractAddress && t.contractAddress.toLowerCase() === recipient)) {
    return refuse(422, "Recipient is a token contract");
  }
  if (asset.network === "near" && isNamedNearAccount(request.recipient) && !(await deps.nearAccountExists(request.recipient))) {
    return refuse(422, "Recipient account does not exist");
  }

  return { ok: true, request };
}
