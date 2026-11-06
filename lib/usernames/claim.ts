import "server-only";
import { createPublicClient, createWalletClient, http, isHex, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import { RUMA_REGISTRAR_ADDRESS, rumaRegistrarAbi } from "./registrar";
import { claimFailure, isNonceClash, type ClaimFailure } from "./claim-errors";

export class ClaimError extends Error {
  constructor(readonly failure: ClaimFailure) {
    super(`Username claim failed: ${failure}`);
    this.name = "ClaimError";
  }
}

/**
 * The writer wallet: the registrar's `claimer`. Its key is a server-only env
 * var and never reaches the browser. It can only create new names (the
 * contract refuses to change existing ones), so a leak costs gas and junk
 * names, not anyone's money. It needs a little ETH on mainnet for gas.
 */
function writer() {
  const key = process.env.ENS_WRITER_PRIVATE_KEY?.trim();
  if (!key || !isHex(key) || key.length !== 66 || !RUMA_REGISTRAR_ADDRESS) return null;
  const transport = http(process.env.MAINNET_RPC_URL || process.env.NEXT_PUBLIC_MAINNET_RPC_URL);
  const account = privateKeyToAccount(key);
  return {
    account,
    registrar: RUMA_REGISTRAR_ADDRESS,
    publicClient: createPublicClient({ chain: mainnet, transport }),
    walletClient: createWalletClient({ account, chain: mainnet, transport }),
  };
}

export function claimsConfigured(): boolean {
  return writer() !== null;
}

/**
 * Sends `RumaRegistrar.claim(label, owner)` and returns the transaction hash
 * without waiting for it to be mined; the app waits for the receipt itself.
 * Simulates first, so a taken name or an address that already has one is
 * refused before any gas is spent.
 */
export async function submitClaim(label: string, owner: Address): Promise<Hash> {
  const w = writer();
  if (!w) throw new ClaimError("unavailable");

  let request;
  try {
    ({ request } = await w.publicClient.simulateContract({
      account: w.account,
      address: w.registrar,
      abi: rumaRegistrarAbi,
      functionName: "claim",
      args: [label, owner],
    }));
  } catch (err) {
    throw new ClaimError(claimFailure(err));
  }

  for (let attempt = 0; ; attempt++) {
    try {
      return await w.walletClient.writeContract(request);
    } catch (err) {
      if (attempt === 0 && isNonceClash(err)) continue;
      console.error("Username claim could not be sent", err instanceof Error ? err.message : "unknown");
      throw new ClaimError("unavailable");
    }
  }
}
