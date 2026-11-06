import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { buildLimiter, guardRequest, type Limiter } from "@/lib/intents/guard";
import { handleProblem, parseHandle } from "@/lib/usernames/handle";
import { USERNAMES_ENABLED } from "@/lib/usernames/registrar";
import { ClaimError, claimsConfigured, submitClaim } from "@/lib/usernames/claim";
import type { ClaimFailure } from "@/lib/usernames/claim-errors";

export const runtime = "nodejs";

/** Every claim spends the writer's ETH, so each user gets only a few tries. */
const CLAIM_RATE_LIMIT = { limit: 5, windowMs: 10 * 60_000 };
let limiter: Limiter | undefined;

const FAILURE_STATUS: Record<ClaimFailure, number> = { taken: 409, hasName: 409, invalid: 400, unavailable: 503 };

/** Claims `label`.rumalatam.eth for one of the caller's own wallets. Returns the transaction hash. */
export async function POST(request: NextRequest) {
  if (!USERNAMES_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!claimsConfigured() || !process.env.PRIVY_APP_SECRET || !process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return NextResponse.json({ error: "Usernames are not configured", failure: "unavailable" }, { status: 503 });
  }

  limiter ??= await buildLimiter(CLAIM_RATE_LIMIT, "ruma:usernames");
  // Imported lazily, like the intents routes, so the Privy SDK loads only when needed.
  const { userOwnsWallet, verifyPrivyToken } = await import("@/lib/intents/privy-server");
  // Always signed in, whatever INTENTS_AUTH_REQUIRED says: this spends real ETH.
  const caller = await guardRequest(request, {
    config: { authRequired: true, rateLimit: CLAIM_RATE_LIMIT },
    verify: verifyPrivyToken,
    limiter,
  });
  if (caller instanceof Response) return caller;

  const body = (await request.json().catch(() => null)) as { label?: unknown; address?: unknown } | null;
  const label = typeof body?.label === "string" ? parseHandle(body.label) : "";
  const address = typeof body?.address === "string" ? body.address : "";
  const problem = handleProblem(label);
  if (problem) return NextResponse.json({ error: "Invalid username", failure: "invalid", problem }, { status: 400 });
  if (!isAddress(address)) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  try {
    if (!(await userOwnsWallet(caller.userId!, address))) {
      return NextResponse.json({ error: "That wallet is not yours" }, { status: 403 });
    }
  } catch (err) {
    // A 401 here means PRIVY_APP_SECRET doesn't match NEXT_PUBLIC_PRIVY_APP_ID.
    console.error("Username claim: Privy wallet check failed", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not check your wallet", failure: "unavailable" }, { status: 503 });
  }

  try {
    const hash = await submitClaim(label, address);
    return NextResponse.json({ hash, label });
  } catch (err) {
    const failure: ClaimFailure = err instanceof ClaimError ? err.failure : "unavailable";
    return NextResponse.json({ error: "Could not claim username", failure }, { status: FAILURE_STATUS[failure] });
  }
}
