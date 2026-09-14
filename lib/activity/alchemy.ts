import { fromDecimalString } from "@/lib/money/money";
import { USDC_ADDRESS_BASE } from "@/lib/usdc";
import type { ActivityEntry, ActivityProvider } from "./activity";

interface AssetTransfer {
  uniqueId: string;
  from: string;
  to: string | null;
  value: number | null;
  metadata?: { blockTimestamp?: string };
}

function endpoint(): string {
  const key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_ALCHEMY_API_KEY is not set");
  }
  return `https://base-mainnet.g.alchemy.com/v2/${key}`;
}

async function getAssetTransfers(
  address: string,
  direction: "from" | "to"
): Promise<AssetTransfer[]> {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: "0x0",
          toBlock: "latest",
          category: ["erc20"],
          contractAddresses: [USDC_ADDRESS_BASE],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: "0x19",
          order: "desc",
          [direction === "from" ? "fromAddress" : "toAddress"]: address,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy responded ${response.status}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`Alchemy: ${body.error.message}`);
  }

  return body.result?.transfers ?? [];
}

function toEntry(transfer: AssetTransfer, outgoing: boolean): ActivityEntry {
  // `value` arrives already scaled by the token's decimals.
  const magnitude = (transfer.value ?? 0).toFixed(2);
  const counterparty = (outgoing ? transfer.to : transfer.from) ?? "";

  return {
    id: transfer.uniqueId,
    kind: outgoing ? "sent" : "received",
    counterparty,
    amount: fromDecimalString(outgoing ? `-${magnitude}` : magnitude, "USD"),
    // A transfer that made it on-chain is settled; pending states live in the
    // p2p.me order flow, not here.
    status: "delivered",
    occurredAt: new Date(transfer.metadata?.blockTimestamp ?? Date.now()),
  };
}

/**
 * Reads settled USDC transfers on Base. It knows nothing about p2p.me order
 * states — a send in progress is tracked by that flow until it lands here.
 */
export const alchemyActivityProvider: ActivityProvider = {
  async list(address: string): Promise<ActivityEntry[]> {
    const [sent, received] = await Promise.all([
      getAssetTransfers(address, "from"),
      getAssetTransfers(address, "to"),
    ]);

    return [...sent.map((t) => toEntry(t, true)), ...received.map((t) => toEntry(t, false))].sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
    );
  },
};
