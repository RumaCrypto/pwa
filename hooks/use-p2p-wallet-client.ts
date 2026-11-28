"use client";

import { useCallback } from "react";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import {
  createWalletClient,
  custom,
  type Address,
  type EIP1193Provider,
  type Hex,
  type WalletClient,
} from "viem";
import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";
import { FLAGS } from "@/lib/flags";
import { describeError } from "@/lib/errors/describe-error";

type SponsoredSend = ReturnType<typeof useSendTransaction>["sendTransaction"];

interface RpcTransaction {
  to?: Hex;
  data?: Hex;
  value?: Hex;
}

/**
 * Routes `eth_sendTransaction` through Privy's native gas sponsorship and
 * everything else to the wallet's own provider. Only `to`, `data` and `value`
 * are forwarded: viem sends JSON-RPC shaped fields (`gas`, hex `type` and
 * `chainId`) that Privy's request type names differently, and the sponsored
 * path estimates gas and fees itself.
 */
export function sponsoredTransport({
  provider,
  sendTransaction,
  address,
  chainId,
}: {
  provider: EIP1193Provider;
  sendTransaction: SponsoredSend;
  address: Address;
  chainId: number;
}) {
  return custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      if (method !== "eth_sendTransaction") {
        return provider.request({ method, params } as never);
      }
      const [tx] = params as [RpcTransaction];
      try {
        const { hash } = await sendTransaction(
          { to: tx.to, data: tx.data, value: tx.value ?? "0x0", chainId },
          { sponsor: true, address },
        );
        return hash; // eth_sendTransaction must resolve to the tx hash
      } catch (error) {
        console.error("[gas-sponsorship] sponsored sendTransaction failed:", describeError(error), error);
        const revert = await simulateRevert(provider, { from: address, ...tx });
        if (revert) {
          console.error("[gas-sponsorship] the call itself reverts:", revert);
          throw new Error(`Transaction reverted: ${revert.summary}`, { cause: error });
        }
        throw error;
      }
    },
  });
}

interface RevertInfo {
  /** The SDK's error code, e.g. "INSUFFICIENT_ALLOWANCE", when the selector is known. */
  code: string | null;
  /** First 4 bytes of the revert data, or null for a bare `revert()`. */
  selector: Hex | null;
  summary: string;
}

/**
 * The bundler reports a reverting call as "Execution reverted for an unknown
 * reason" and drops the revert data. Replaying the same call with `eth_call`
 * from the user's address returns that data, which the p2p SDK can name.
 * Returns null when the call does not revert on its own (the failure is then
 * in the sponsorship path, not the contract).
 */
async function simulateRevert(
  provider: EIP1193Provider,
  call: { from: Address } & RpcTransaction,
): Promise<RevertInfo | null> {
  try {
    await provider.request({
      method: "eth_call",
      params: [{ from: call.from, to: call.to, data: call.data, value: call.value ?? "0x0" }, "latest"],
    } as never);
    return null;
  } catch (error) {
    const data = findRevertData(error);
    const selector = data && data.length >= 10 ? (data.slice(0, 10) as Hex) : null;
    const { parseContractError, getContractErrorMessage } = await import("@p2pdotme/sdk/orders");
    const code = selector ? parseContractError(selector) : null;
    const summary = code
      ? `${code} (${getContractErrorMessage(code)})`
      : selector
        ? `unknown error ${selector}`
        : describeError(error);
    return { code, selector, summary };
  }
}

/** Digs the hex revert data out of an RPC error, wherever the provider nested it. */
function findRevertData(error: unknown, depth = 0): Hex | null {
  if (!error || typeof error !== "object" || depth > 5) return null;
  const { data, cause } = error as { data?: unknown; cause?: unknown };
  if (typeof data === "string" && data.startsWith("0x")) return data as Hex;
  return findRevertData(data, depth + 1) ?? findRevertData(cause, depth + 1);
}

/** Resolves a signer for the user's Privy wallet, for signing p2p.me orders and transfers. */
export function useP2pWalletClient({ sponsor = FLAGS.gasSponsorship }: { sponsor?: boolean } = {}) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  return useCallback(async (): Promise<{
    walletClient: WalletClient;
    address: Address;
  }> => {
    const address = user?.wallet?.address;
    if (!address) throw new Error("No wallet connected");

    const wallet =
      wallets.find((candidate) => candidate.address === address) ?? wallets[0];
    if (!wallet) throw new Error("No wallet connected");

    // Embedded wallets default to Ethereum mainnet; without switching first,
    // Privy's provider rejects a Base request at the provider level before
    // ever opening the approval modal.
    await wallet.switchChain(DEFAULT_SETTLEMENT_NETWORK.id);
    const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;

    const transport = sponsor
      ? sponsoredTransport({
          provider,
          sendTransaction,
          address: address as Address,
          chainId: DEFAULT_SETTLEMENT_NETWORK.id,
        })
      : custom(provider);

    const walletClient = createWalletClient({
      account: address as Address,
      chain: DEFAULT_SETTLEMENT_NETWORK,
      transport,
    });

    return { walletClient, address: address as Address };
  }, [user?.wallet?.address, wallets, sendTransaction, sponsor]);
}
