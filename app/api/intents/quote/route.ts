import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey, auroraUrl } from "@/lib/intents/aurora";
import { intentsGuard } from "@/lib/intents/guard";
import { userOwnsWallet } from "@/lib/intents/privy-server";
import { refundModeFrom, validateQuoteRequest } from "@/lib/intents/quote";

export const runtime = "nodejs";

// Aurora waits on solvers for a price, which can take a few seconds.
const FETCH_TIMEOUT_MS = 20000;

export async function POST(request: NextRequest) {
  const caller = await intentsGuard(request, "quote");
  if (caller instanceof Response) return caller;

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  const quoteRequest = validateQuoteRequest(
    await request.json().catch(() => null),
    refundModeFrom(process.env.NEXT_PUBLIC_INTENTS_REFUND_MODE)
  );
  if (!quoteRequest) return NextResponse.json({ error: "Invalid quote request" }, { status: 400 });

  if (caller.userId) {
    let owns: boolean;
    try {
      owns = await userOwnsWallet(caller.userId, quoteRequest.recipient);
    } catch {
      return NextResponse.json({ error: "Could not verify wallet" }, { status: 502 });
    }
    if (!owns) return NextResponse.json({ error: "Recipient must be your own wallet" }, { status: 403 });
  }

  try {
    const response = await fetch(auroraUrl("quote", apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quoteRequest),
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
