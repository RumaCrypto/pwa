export interface GuardConfig {
  authRequired: boolean;
  rateLimit: { limit: number; windowMs: number } | null;
}

const DEFAULT_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

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
    if (match) rateLimit = { limit: Number(match[1]), windowMs: Number(match[2]) * 1000 };
  }

  return { authRequired: env.INTENTS_AUTH_REQUIRED !== "false", rateLimit };
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
    } catch {
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

/** Redis when Upstash is connected (exact across Vercel instances), memory otherwise. */
async function buildLimiter(rateLimit: NonNullable<GuardConfig["rateLimit"]>): Promise<Limiter> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(rateLimit.limit, `${rateLimit.windowMs / 1000} s`),
      prefix: "ruma:intents",
    });
    return async (key) => (await ratelimit.limit(key)).success;
  }
  return createMemoryLimiter(rateLimit.limit, rateLimit.windowMs);
}

export async function intentsGuard(request: Request): Promise<Caller | Response> {
  const config = readGuardConfig();
  if (sharedLimiter === undefined) {
    sharedLimiter = config.rateLimit ? await buildLimiter(config.rateLimit) : null;
  }
  // Imported lazily so tests of guardRequest never load the Privy SDK.
  const { verifyPrivyToken } = await import("./privy-server");
  return guardRequest(request, { config, verify: verifyPrivyToken, limiter: sharedLimiter });
}
