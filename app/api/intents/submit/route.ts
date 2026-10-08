import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey, auroraUrl } from "@/lib/intents/aurora";
import { intentsGuard } from "@/lib/intents/guard";
import { validateSubmission } from "@/lib/intents/submit";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8000;

/** Tells Aurora a withdrawal's transfer is on-chain so it picks it up sooner. Best effort: status polling finds it anyway. */
export async function POST(request: NextRequest) {
  const caller = await intentsGuard(request, "submit");
  if (caller instanceof Response) return caller;
  if (!caller.userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  const submission = validateSubmission(await request.json().catch(() => null));
  if (!submission) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });

  try {
    const response = await fetch(auroraUrl("deposit/submit", apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
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
