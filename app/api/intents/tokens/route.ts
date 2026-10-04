import { NextResponse } from "next/server";
import { auroraApiKey, auroraUrl } from "@/lib/intents/aurora";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8000;

/** The token list changes rarely; caching it spares Aurora's per-key rate limit. */
export async function GET() {
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
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fetch failed" }, { status: 502 });
  }
}
