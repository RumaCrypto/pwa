import { describe, expect, it, vi } from "vitest";
import type { WalletClient } from "viem";

import { erc20TransferAbi, USDC_ADDRESS_BASE } from "@/lib/usdc";
import { confirmUsdcTransfer, sendUsdcTransfer } from "./order-execution";

const FROM = "0x1111111111111111111111111111111111111111" as const;
const TO = "0x5aeda56215b167893e80b4fe645ba6d5bab767de" as const;

/** Stands in for the wallet client's `writeContract`, which normally opens the signer's approval. */
function stubWalletClient(txHash: `0x${string}`): WalletClient {
  const writeContract = vi.fn(async () => txHash);
  return { writeContract } as unknown as WalletClient;
}

describe("sendUsdcTransfer", () => {
  it("submits the USDC contract's transfer and returns its hash without waiting for a block", async () => {
    const walletClient = stubWalletClient("0xabc");

    const hash = await sendUsdcTransfer({ walletClient, userAddress: FROM, to: TO, usdcAmount: 200_000_000n });

    expect(walletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: USDC_ADDRESS_BASE,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [TO, 200_000_000n],
        account: FROM,
      })
    );
    expect(hash).toBe("0xabc");
  });

  it("rejects an invalid recipient without touching the wallet", async () => {
    const walletClient = stubWalletClient("0xabc");

    await expect(
      sendUsdcTransfer({
        walletClient,
        userAddress: FROM,
        // A contact's stored reference isn't re-validated on read, so a
        // corrupted or hand-edited one has to be caught here at send time.
        to: "not-an-address" as unknown as typeof TO,
        usdcAmount: 1n,
      })
    ).rejects.toThrow(/invalid/i);

    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });
});

describe("confirmUsdcTransfer", () => {
  it("resolves to the fee paid, in wei", async () => {
    const waitForReceipt = vi.fn(async () => ({ status: "success" as const, gasUsed: 65_000n, effectiveGasPrice: 1_000_000n }));

    await expect(confirmUsdcTransfer("0xabc", waitForReceipt)).resolves.toEqual({ feeWei: 65_000_000_000n });
    expect(waitForReceipt).toHaveBeenCalledWith({ hash: "0xabc" });
  });

  it("throws when the transfer reverted", async () => {
    const waitForReceipt = vi.fn(async () => ({ status: "reverted" as const, gasUsed: 1n, effectiveGasPrice: 1n }));

    await expect(confirmUsdcTransfer("0xabc", waitForReceipt)).rejects.toThrow(/rejected/i);
  });
});
