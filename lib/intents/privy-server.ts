import "server-only";
import { PrivyClient } from "@privy-io/node";
import { ownsWallet } from "./wallets";

let client: PrivyClient | null = null;

function privy(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) throw new Error("PRIVY_APP_SECRET is not set");
  return (client ??= new PrivyClient({ appId, appSecret: secret }));
}

export async function verifyPrivyToken(token: string): Promise<{ userId: string }> {
  const claims = await privy().utils().auth().verifyAccessToken(token);
  return { userId: claims.user_id };
}

/** The quote route checks the deposit lands in one of the caller's own wallets, not someone else's. */
export async function userOwnsWallet(userId: string, address: string): Promise<boolean> {
  const user = await privy().users()._get(userId);
  return ownsWallet(user.linked_accounts, address);
}
