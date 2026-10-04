import "server-only";
import { PrivyClient } from "@privy-io/node";

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

/**
 * The quote route checks the deposit lands in the caller's own wallet, not someone else's.
 * Mirrors the client's `user.wallet`: the first Ethereum wallet linked to the user.
 */
export async function userWalletAddress(userId: string): Promise<string | null> {
  const user = await privy().users()._get(userId);
  for (const account of user.linked_accounts) {
    if (account.type === "wallet" && account.chain_type === "ethereum") return account.address;
  }
  return null;
}
