"use client";

import { useCallback } from "react";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import {
  createWalletClient,
  custom,
  // Hex,
  type Address,
  type WalletClient,
} from "viem";
import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";

/** Resolves a signer for the user's Privy wallet, for signing p2p.me sell orders. */
export function useP2pWalletClient() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  // const { sendTransaction } = useSendTransaction();

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
    const provider = await wallet.getEthereumProvider();

    // const sponsoredTransport = custom({
    //   async request({ method, params }: { method: string; params?: unknown }) {
    //     if (method === "eth_sendTransaction") {
    //       const [tx] = params as [Record<string, unknown>];
    //       const { hash } = await sendTransaction(
    //         { ...tx, chainId: DEFAULT_SETTLEMENT_NETWORK.id },
    //         { sponsor: true, address },
    //       );
    //       return hash as Hex; // eth_sendTransaction must resolve to the tx hash
    //     }
    //     return provider.request({ method, params } as never);
    //   },
    // });

    const walletClient = createWalletClient({
      account: address as Address,
      chain: DEFAULT_SETTLEMENT_NETWORK,
      transport: custom(provider), // TODO: Use sponsoredTransport once sponsoring is solved (Issue with "walletClient.sendTransaction rejected")
    });

    return { walletClient, address: address as Address };
  }, [user?.wallet?.address, wallets]);
}
