import "server-only";
import { isImplicitNearAccount } from "./addresses";

const DEFAULT_NEAR_RPC = "https://free.rpc.fastnear.com";

/**
 * A transfer to a named NEAR account that was never registered does not
 * arrive, so withdrawals to one are refused before quoting. Implicit accounts
 * (64 hex) exist as soon as they receive funds, so they need no check.
 */
export async function nearAccountExists(accountId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (isImplicitNearAccount(accountId)) return true;

  const response = await fetchImpl(process.env.NEAR_RPC_URL || DEFAULT_NEAR_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "ruma",
      method: "query",
      params: { request_type: "view_account", finality: "final", account_id: accountId },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`NEAR RPC answered ${response.status}`);

  const body = (await response.json()) as { result?: unknown; error?: { cause?: { name?: unknown } } };
  if (body.result) return true;
  if (body.error?.cause?.name === "UNKNOWN_ACCOUNT") return false;
  throw new Error(`NEAR RPC error: ${String(body.error?.cause?.name ?? "unknown")}`);
}
