import "server-only";
import { tokenList, type IntentsToken } from "./networks";

export const AURORA_API_URL = "https://intents-api.aurora.dev";

type Endpoint = "tokens" | "quote" | "status" | "deposit/submit";

export function auroraUrl(endpoint: Endpoint, apiKey: string, query?: Record<string, string>): string {
  const url = new URL(`/api/${endpoint}/${encodeURIComponent(apiKey)}`, AURORA_API_URL);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * Aurora says the key is safe to expose, but it carries our fee settings and
 * rate limit, so it stays on the server like any other credential.
 */
export function auroraApiKey(): string | null {
  return process.env.AURORA_INTENTS_API_KEY || null;
}

/** For the server's own checks (e.g. the withdrawal allow-list); cached like the tokens route. */
export async function fetchAuroraTokens(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<IntentsToken[]> {
  const response = await fetchImpl(auroraUrl("tokens", apiKey), {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(8000),
  } as RequestInit);
  if (!response.ok) throw new Error(`Aurora tokens answered ${response.status}`);
  const tokens = tokenList(await response.json());
  if (!tokens) throw new Error("Aurora tokens is not a list");
  return tokens;
}
