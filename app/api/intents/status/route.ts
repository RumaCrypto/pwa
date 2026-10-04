import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey, auroraUrl } from "@/lib/intents/aurora";
import { intentsGuard } from "@/lib/intents/guard";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8000;

export async function GET(request: NextRequest) {
  const caller = await intentsGuard(request);
  if (caller instanceof Response) return caller;

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  const depositAddress = request.nextUrl.searchParams.get("depositAddress");
  if (!depositAddress) return NextResponse.json({ error: "Missing depositAddress" }, { status: 400 });

  const query: Record<string, string> = { depositAddress };
  const depositMemo = request.nextUrl.searchParams.get("depositMemo");
  if (depositMemo) query.depositMemo = depositMemo;

  try {
    const response = await fetch(auroraUrl("status", apiKey, query), {
      cache: "no-store",
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
