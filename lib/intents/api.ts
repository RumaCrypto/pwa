import type { IntentsToken } from "./networks";
import { parseQuoteResponse, type QuoteRequest, type QuoteResult } from "./quote";
import { parseStatusResponse, type StatusResult } from "./status";

/** Keeps the HTTP status so the screen can tell our own refusals from Aurora's messages. */
export class IntentsApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "IntentsApiError";
  }
}

async function errorFrom(response: Response): Promise<IntentsApiError> {
  const body = (await response.json().catch(() => null)) as { message?: unknown; error?: unknown } | null;
  const message = body?.message ?? body?.error;
  return new IntentsApiError(typeof message === "string" ? message : `Request failed (${response.status})`, response.status);
}

/** The routes check the Privy session when INTENTS_AUTH_REQUIRED is on; sending it always keeps the client agnostic. */
function authHeaders(accessToken: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function fetchTokens(accessToken: string | null, fetchImpl: typeof fetch = fetch): Promise<IntentsToken[]> {
  const response = await fetchImpl("/api/intents/tokens", { headers: authHeaders(accessToken) });
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}

export async function requestDepositQuote(
  request: QuoteRequest,
  accessToken: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<QuoteResult> {
  const response = await fetchImpl("/api/intents/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw await errorFrom(response);
  return parseQuoteResponse(await response.json());
}

export async function fetchDepositStatus(
  address: string,
  memo: string | undefined,
  accessToken: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<StatusResult> {
  const query = new URLSearchParams({ depositAddress: address });
  if (memo) query.set("depositMemo", memo);
  const response = await fetchImpl(`/api/intents/status?${query}`, { headers: authHeaders(accessToken) });
  if (!response.ok) throw await errorFrom(response);
  return parseStatusResponse(await response.json());
}
