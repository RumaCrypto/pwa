import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey } from "@/lib/intents/aurora";
import { intentsGuard } from "@/lib/intents/guard";
import { createPersistentAddress } from "@/lib/intents/persistent-handler";
import { userOwnsWallet } from "@/lib/intents/privy-server";

export const runtime = "nodejs";

/** The caller's permanent deposit address on a network that uses one (Tron). */
export async function POST(request: NextRequest) {
  const caller = await intentsGuard(request, "persistent-address");
  if (caller instanceof Response) return caller;

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  const result = await createPersistentAddress(body, caller.userId, { apiKey, ownsWallet: userOwnsWallet });
  return NextResponse.json(result.body, { status: result.status });
}
