import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey, auroraUrl, fetchAuroraTokens } from "./aurora";
import { intentsGuard } from "./guard";
import { nearAccountExists } from "./near-account";
import { userOwnsWallet } from "./privy-server";
import { isWithdrawalBody, refundModeFrom, validateQuoteRequest } from "./quote";
import { checkWithdrawRequest, type WithdrawCheck } from "./withdraw-check";

// Aurora waits on solvers for a price, which can take a few seconds.
const FETCH_TIMEOUT_MS = 20000;

/**
 * One handler for live and dry quotes. Dry quotes (the form's "you'll receive")
 * have their own route only so they count against their own rate limit, and
 * each route accepts only its own kind.
 */
export async function handleQuote(request: NextRequest, mode: "live" | "dry"): Promise<Response> {
  const caller = await intentsGuard(request, mode === "dry" ? "quote-dry" : "quote");
  if (caller instanceof Response) return caller;

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  let forward: object;

  if (isWithdrawalBody(body)) {
    let check: WithdrawCheck;
    try {
      check = await checkWithdrawRequest(body, {
        userId: caller.userId,
        dry: mode === "dry",
        tokens: () => fetchAuroraTokens(apiKey),
        ownsWallet: userOwnsWallet,
        nearAccountExists: (id) => nearAccountExists(id),
      });
    } catch (err) {
      // Never log the request: it holds the user's addresses and amount.
      console.error("Withdrawal check failed", err instanceof Error ? err.name : "unknown");
      return NextResponse.json({ error: "Could not verify the withdrawal" }, { status: 502 });
    }
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    forward = check.request;
  } else {
    if (mode === "dry") return NextResponse.json({ error: "Invalid quote request" }, { status: 400 });
    const quoteRequest = validateQuoteRequest(body, refundModeFrom(process.env.NEXT_PUBLIC_INTENTS_REFUND_MODE));
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
    forward = quoteRequest;
  }

  try {
    const response = await fetch(auroraUrl("quote", apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forward),
      cache: "no-store",
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
