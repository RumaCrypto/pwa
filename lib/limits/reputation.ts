import {
  LIVENESS_DEFAULT_TENANT,
  createLivenessFlow,
  createZkkyc,
  resumeLivenessFlow,
} from "@p2pdotme/sdk/zkkyc";
import type { Address, WalletClient } from "viem";

import { baseClient } from "@/lib/viem";

const REPUTATION_MANAGER = process.env.NEXT_PUBLIC_P2P_REPUTATION_MANAGER_ADDRESS as Address | undefined;
const LIVENESS_PROXY_URL = process.env.NEXT_PUBLIC_P2P_LIVENESS_PROXY_URL;

/**
 * Every way p2p.me's Reputation Manager can credit Reputation Points (RP),
 * which is what a BUY limit is made of — a wallet with no RP can sell but
 * cannot buy at all. Aadhaar and BVN only exist for India and Nigeria.
 */
export const VERIFICATION_METHODS = ["liveness", "document", "zkPassport", "social", "aadhaar", "bvn"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const METHOD_COUNTRIES: Partial<Record<VerificationMethod, string>> = { aadhaar: "IN", bvn: "NG" };

/** Only liveness is wired up; the rest show as coming soon. */
export const ENABLED_METHODS: ReadonlySet<VerificationMethod> = new Set(["liveness"]);

/**
 * The SDK's zkkyc module only prepares writes, so the per-method views are
 * read directly. Social, ZK Passport and Aadhaar have no such view.
 */
const VERIFIED_VIEWS: Partial<Record<VerificationMethod, "livenessVerified" | "kycVerified" | "bvnVerified">> = {
  liveness: "livenessVerified",
  document: "kycVerified",
  bvn: "bvnVerified",
};

const verifiedViewsAbi = (["livenessVerified", "kycVerified", "bvnVerified"] as const).map(
  (name) =>
    ({
      type: "function",
      name,
      stateMutability: "view",
      inputs: [{ name: "", type: "address" }],
      outputs: [{ name: "", type: "bool" }],
    }) as const
);

export function isLivenessConfigured(): boolean {
  return Boolean(REPUTATION_MANAGER && LIVENESS_PROXY_URL);
}

/** Which methods this wallet has completed, for those the contract exposes; others are absent. */
export async function readVerifiedMethods(address: Address): Promise<Partial<Record<VerificationMethod, boolean>>> {
  if (!REPUTATION_MANAGER) return {};

  const entries = Object.entries(VERIFIED_VIEWS) as [VerificationMethod, (typeof verifiedViewsAbi)[number]["name"]][];
  const results = await Promise.allSettled(
    entries.map(([, functionName]) =>
      baseClient.readContract({ address: REPUTATION_MANAGER, abi: verifiedViewsAbi, functionName, args: [address] })
    )
  );

  const verified: Partial<Record<VerificationMethod, boolean>> = {};
  entries.forEach(([method], index) => {
    const result = results[index];
    if (result.status === "fulfilled") verified[method] = result.value;
  });
  return verified;
}

const LIVENESS_STATE_KEY = "ruma-liveness-state";

/**
 * Sends the user to the hosted liveness wizard. It redirects back to
 * `returnPath` with `?code=&state=`; `completeLiveness` takes it from there.
 * The proxy only accepts redirect URIs on its tenant allowlist, so this
 * origin has to be registered with p2p.me.
 */
export async function startLiveness(walletAddress: Address, returnPath: string): Promise<void> {
  if (!LIVENESS_PROXY_URL) throw new Error("NEXT_PUBLIC_P2P_LIVENESS_PROXY_URL is not set");

  const state = crypto.randomUUID();
  sessionStorage.setItem(LIVENESS_STATE_KEY, state);

  const result = await createLivenessFlow({
    baseUrl: LIVENESS_PROXY_URL,
    walletAddress,
    tenant: LIVENESS_DEFAULT_TENANT,
    redirectUrl: `${window.location.origin}${returnPath}`,
    state,
  });
  if (result.isErr()) throw result.error;
  result.value.redirect();
}

/**
 * Redeems the wizard's one-time `code` for a signed attestation and submits
 * it to the Reputation Manager from the user's wallet, which is what credits
 * the RP. Rejects a `state` this browser did not start.
 */
export async function completeLiveness({
  code,
  state,
  walletClient,
}: {
  code: string;
  state: string | null;
  walletClient: WalletClient;
}): Promise<`0x${string}`> {
  if (!LIVENESS_PROXY_URL || !REPUTATION_MANAGER) throw new Error("Liveness verification is not configured");

  const expected = sessionStorage.getItem(LIVENESS_STATE_KEY);
  sessionStorage.removeItem(LIVENESS_STATE_KEY);
  if (!expected || expected !== state) throw new Error("This verification was not started from this device");

  const attestation = await resumeLivenessFlow({ baseUrl: LIVENESS_PROXY_URL, code });
  if (attestation.isErr()) throw attestation.error;

  const prepared = createZkkyc({ reputationManagerAddress: REPUTATION_MANAGER }).prepareSubmitLivenessAttestation(
    attestation.value
  );
  if (prepared.isErr()) throw prepared.error;

  const hash = await walletClient.sendTransaction({
    account: walletClient.account!,
    chain: walletClient.chain,
    to: prepared.value.to,
    data: prepared.value.data,
  });
  await baseClient.waitForTransactionReceipt({ hash });
  return hash;
}
