export const AURORA_API_URL = "https://intents-api.aurora.dev";

type Endpoint = "tokens" | "quote" | "status";

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
