import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey, auroraUrl, fetchAuroraTokens } from "@/lib/intents/aurora";
import { intentsGuard } from "@/lib/intents/guard";
import { remoteActivity, type IntentActivityItem } from "@/lib/intents/history";
import { userWallets } from "@/lib/intents/privy-server";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8000;
/** Privy users link a handful of wallets at most; this bounds the calls to Aurora. */
const MAX_WALLETS = 5;

/**
 * The caller's deposits and withdrawals as Aurora recorded them, so they show
 * on any device. Only ever asks about the caller's own wallets, taken from
 * their Privy account rather than from the request.
 */
export async function GET(request: NextRequest) {
  const caller = await intentsGuard(request, "history");
  if (caller instanceof Response) return caller;
  if (!caller.userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  let wallets: string[];
  try {
    wallets = (await userWallets(caller.userId)).slice(0, MAX_WALLETS);
  } catch {
    return NextResponse.json({ error: "Could not verify wallet" }, { status: 502 });
  }
  if (wallets.length === 0) return NextResponse.json([]);

  try {
    const tokens = await fetchAuroraTokens(apiKey);
    const answers = await Promise.all(
      wallets.map(async (walletAddress) => {
        const response = await fetch(auroraUrl("transactions", apiKey, { walletAddress }), {
          cache: "no-store",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        return response.ok ? response.json() : [];
      })
    );
    const byId = new Map<string, IntentActivityItem>();
    for (const answer of answers) {
      for (const item of remoteActivity(answer, tokens, wallets)) byId.set(item.id, item);
    }
    return NextResponse.json([...byId.values()]);
  } catch {
    return NextResponse.json({ error: "Could not reach Aurora" }, { status: 502 });
  }
}
