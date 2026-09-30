import { encodeFunctionData, parseUnits, type Address, type WalletClient } from "viem";

import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";
import { baseClient } from "@/lib/viem";
import { USDC_ADDRESS_BASE, USDC_DECIMALS, erc20TransferAbi } from "@/lib/usdc";

const TRANSFERS_KEY = "ruma-wallet-transfers";

/** "sent" = broadcast to the network; "confirmed" = mined successfully. */
export type TransferStatus = "sent" | "confirmed" | "failed";

export interface WalletTransfer {
  /** The transaction hash. */
  id: `0x${string}`;
  to: Address;
  /** Decimal USDC, as typed. */
  amount: string;
  networkName: string;
  createdAt: string;
  status: TransferStatus;
}

export const TRANSFER_STEPS = ["sent", "confirmed"] as const;

function readAll(): WalletTransfer[] {
  try {
    const raw = localStorage.getItem(TRANSFERS_KEY);
    return raw ? (JSON.parse(raw) as WalletTransfer[]) : [];
  } catch {
    return [];
  }
}

function writeAll(transfers: WalletTransfer[]): void {
  localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers));
}

export function getTransfer(id: string): WalletTransfer | undefined {
  return readAll().find((transfer) => transfer.id === id);
}

export function updateTransfer(id: string, patch: Partial<WalletTransfer>): WalletTransfer | undefined {
  const all = readAll();
  const index = all.findIndex((transfer) => transfer.id === id);
  if (index === -1) return undefined;

  all[index] = { ...all[index], ...patch };
  writeAll(all);
  return all[index];
}

export interface SendUsdcParams {
  walletClient: WalletClient;
  from: Address;
  to: Address;
  /** Decimal USDC, e.g. "12.5". */
  amount: string;
}

/**
 * Broadcasts a USDC transfer on the settlement network (fees sponsored by the
 * wallet client's transport) and records it. Resolves once the transaction is
 * submitted, not mined — the tracking screen polls for the receipt.
 */
export async function sendUsdc({ walletClient, from, to, amount }: SendUsdcParams): Promise<WalletTransfer> {
  const data = encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [to, parseUnits(amount, USDC_DECIMALS)],
  });

  const hash = await walletClient.sendTransaction({
    account: from,
    chain: DEFAULT_SETTLEMENT_NETWORK,
    to: USDC_ADDRESS_BASE,
    data,
  });

  const transfer: WalletTransfer = {
    id: hash,
    to,
    amount,
    networkName: DEFAULT_SETTLEMENT_NETWORK.name,
    createdAt: new Date().toISOString(),
    status: "sent",
  };
  writeAll([transfer, ...readAll()]);
  return transfer;
}

/** Waits for the receipt and reports whether the transfer succeeded. */
export async function waitForTransfer(hash: `0x${string}`): Promise<"confirmed" | "failed"> {
  const receipt = await baseClient.waitForTransactionReceipt({ hash, timeout: 5 * 60_000 });
  return receipt.status === "success" ? "confirmed" : "failed";
}
