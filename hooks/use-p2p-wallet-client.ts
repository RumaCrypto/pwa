"use client";

import { useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { base } from "viem/chains";
import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";

/** Resolves a signer for the user's Privy wallet, for signing p2p.me sell orders. */
export function useP2pWalletClient() {
  const { user } = usePrivy();
  const { wallets } = useWallets();

  return useCallback(async (): Promise<{ walletClient: WalletClient; address: Address }> => {
    const address = user?.wallet?.address;
    if (!address) throw new Error("No wallet connected");

    const wallet = wallets.find((candidate) => candidate.address === address) ?? wallets[0];
    if (!wallet) throw new Error("No wallet connected");

    // Embedded wallets default to Ethereum mainnet; without switching first,
    // Privy's provider rejects a Base request at the provider level before
    // ever opening the approval modal.
    await wallet.switchChain(DEFAULT_SETTLEMENT_NETWORK.id);
    const provider = await wallet.getEthereumProvider();
    const walletClient = createWalletClient({
      account: address as Address,
      chain: base,
      transport: custom(provider),
    });

    return { walletClient, address: address as Address };
  }, [user?.wallet?.address, wallets]);
}
