import { FLAGS } from "@/lib/flags";

export interface GuardConfig {
  authRequired: boolean;
  rateLimit: { limit: number; windowMs: number } | null;
}

const DEFAULT_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

/**
 * The /api/intents routes spend our Aurora key, so by default only signed-in
 * users get through, and each only so often. Both are env-tunable: auth can be
 * dropped for local work, and the limit loosened or turned off.
 */
export function readGuardConfig(env: Record<string, string | undefined> = process.env): GuardConfig {
  const raw = env.INTENTS_RATE_LIMIT?.trim();
  let rateLimit: GuardConfig["rateLimit"] = DEFAULT_RATE_LIMIT;
  if (raw === "off") rateLimit = null;
  else if (raw) {
    const match = /^(\d+)\/(\d+)$/.exec(raw);
    const limit = match ? Number(match[1]) : 0;
    const seconds = match ? Number(match[2]) : 0;
    if (limit > 0 && seconds > 0) rateLimit = { limit, windowMs: seconds * 1000 };
  }

  // Dropping the session check is for local work only; withdrawals move real
  // money, so production always checks, whatever the env says.
  const authRequired = env.INTENTS_AUTH_REQUIRED !== "false" || env.VERCEL_ENV === "production";
  return { authRequired, rateLimit };
}

/** Fixed window per key. Per server instance, so on serverless it is a brake, not an exact count. */
export function createMemoryLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string): boolean => {
    const t = now();
    const current = windows.get(key);
    if (!current || t - current.start > windowMs) {
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  };
}

export type Limiter = (key: string) => boolean | Promise<boolean>;

export interface Caller {
  userId: string | null;
  /** What the limiter counts against: the Privy user, or the IP when auth is off. */
  key: string;
}

const deny = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

export async function guardRequest(
  request: Request,
  deps: {
    config: GuardConfig;
    verify: (token: string) => Promise<{ userId: string }>;
    limiter: Limiter | null;
  }
): Promise<Caller | Response> {
  let caller: Caller;

  if (deps.config.authRequired) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return deny(401, "Sign in required");
    try {
      const { userId } = await deps.verify(token);
      caller = { userId, key: userId };
    } catch (err) {
      // Privy unreachable is not the user's fault: saying "session expired" would send them to sign in for nothing.
      if ((err as { name?: unknown } | null)?.name === "SessionCheckUnavailable") return deny(503, "Could not check your session");
      return deny(401, "Invalid session");
    }
  } else {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    caller = { userId: null, key: `ip:${ip}` };
  }

  if (deps.limiter && !(await deps.limiter(caller.key))) return deny(429, "Too many requests, try again in a minute");
  return caller;
}

let sharedLimiter: Limiter | null | undefined;

/**
 * Vercel's Upstash integration sets the UPSTASH_* names, but stores created as
 * "Vercel KV" set KV_REST_API_*; either points at the same kind of database.
 */
export function redisCredentials(
  env: Record<string, string | undefined> = process.env
): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** Redis when Upstash is connected (exact across Vercel instances), memory otherwise. */
async function buildLimiter(rateLimit: NonNullable<GuardConfig["rateLimit"]>): Promise<Limiter> {
  const credentials = redisCredentials();
  if (credentials) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const ratelimit = new Ratelimit({
      redis: new Redis(credentials),
      limiter: Ratelimit.slidingWindow(rateLimit.limit, `${rateLimit.windowMs / 1000} s`),
      prefix: "ruma:intents",
    });
    return async (key) => (await ratelimit.limit(key)).success;
  }
  return createMemoryLimiter(rateLimit.limit, rateLimit.windowMs);
}

export type IntentsRoute = "tokens" | "quote" | "quote-dry" | "status" | "submit";

/** Limits are counted per route, so status polling does not eat the quote budget. */
export async function intentsGuard(request: Request, route: IntentsRoute): Promise<Caller | Response> {
  // With the feature off the routes should not exist, not just be unlinked.
  if (!FLAGS.multichainDeposits) return deny(404, "Not found");
  const config = readGuardConfig();
  if (config.authRequired && (!process.env.PRIVY_APP_SECRET || !process.env.NEXT_PUBLIC_PRIVY_APP_ID)) {
    return deny(503, "Session check is not configured");
  }
  if (sharedLimiter === undefined) {
    sharedLimiter = config.rateLimit ? await buildLimiter(config.rateLimit) : null;
  }
  // Imported lazily so tests of guardRequest never load the Privy SDK.
  const { verifyPrivyToken } = await import("./privy-server");
  const shared = sharedLimiter;
  const limiter: Limiter | null = shared ? (key) => shared(`${route}:${key}`) : null;
  return guardRequest(request, { config, verify: verifyPrivyToken, limiter });
}

/**
 * Privy's SDK reports every verification failure as InvalidAuthTokenError; only
 * the message says whether the token was bad or the check itself couldn't run
 * (its catch-all also covers a timeout fetching the signing keys).
 */
export function sessionCheckFailure(err: unknown): "invalid" | "unavailable" {
  const message = err instanceof Error ? err.message : "";
  return /expired|is invalid/i.test(message) ? "invalid" : "unavailable";
}
