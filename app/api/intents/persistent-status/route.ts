import { NextRequest, NextResponse } from "next/server";
import { auroraApiKey } from "@/lib/intents/aurora";
import { intentsGuard } from "@/lib/intents/guard";
import { readPersistentHistory } from "@/lib/intents/persistent-handler";
import { userOwnsWallet } from "@/lib/intents/privy-server";
import { isPlausibleDepositAddress } from "@/lib/intents/status";

export const runtime = "nodejs";

/** Deposits into a permanent address and the USDC payouts out of it. */
export async function GET(request: NextRequest) {
  const caller = await intentsGuard(request, "persistent-status");
  if (caller instanceof Response) return caller;

  const apiKey = auroraApiKey();
  if (!apiKey) return NextResponse.json({ error: "Deposits from other networks are not configured" }, { status: 503 });

  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isPlausibleDepositAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const result = await readPersistentHistory(address, caller.userId, { apiKey, ownsWallet: userOwnsWallet });
  return NextResponse.json(result.body, { status: result.status });
}
