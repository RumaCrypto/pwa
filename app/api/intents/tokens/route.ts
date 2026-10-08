import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey, auroraUrl } from "@/lib/intents/aurora";
import { intentsGuard } from "@/lib/intents/guard";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8000;

/** The token list changes rarely; caching it spares Aurora's per-key rate limit. */
export async function GET(request: NextRequest) {
  const caller = await intentsGuard(request, "tokens");
  if (caller instanceof Response) return caller;

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  try {
    const response = await fetch(auroraUrl("tokens", apiKey), {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Could not reach Aurora" }, { status: 502 });
  }
}
