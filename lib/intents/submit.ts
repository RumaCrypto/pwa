import { isAddress } from "viem";

/** Only withdrawals submit a tx hash, and they always deposit on Base. */
export function validateSubmission(body: unknown): { txHash: string; depositAddress: string } | null {
  if (!body || typeof body !== "object") return null;
  const { txHash, depositAddress } = body as Record<string, unknown>;
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  if (typeof depositAddress !== "string" || !isAddress(depositAddress)) return null;
  return { txHash, depositAddress };
}
