import type { Order } from "./orders";
import type { Quote } from "./quote";

/** What storage needs from an order; withdrawals have no contact, sends do. */
export type StorableOrder = Omit<Order, "contactId">;

type SerialisedMoney = { amount: string; currency: Quote["send"]["currency"] };

function reviveMoney(value: unknown): Quote["send"] {
  const money = value as SerialisedMoney;
  return { amount: BigInt(money.amount), currency: money.currency };
}

type StoredOrder = Omit<
  StorableOrder,
  "createdAt" | "completedAt" | "quote" | "p2pOrderId" | "actualUsdcAmount" | "actualFiatAmount"
> & {
  createdAt: string;
  completedAt?: string;
  p2pOrderId: string;
  actualUsdcAmount?: string;
  actualFiatAmount?: string;
  quote: Omit<Quote, "lockedAt" | "expiresAt"> & { lockedAt: string; expiresAt: string };
};

export function readOrders<T extends StorableOrder>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    return (JSON.parse(raw) as StoredOrder[]).map(
      (order) =>
        ({
          ...order,
          createdAt: new Date(order.createdAt),
          completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
          p2pOrderId: BigInt(order.p2pOrderId),
          actualUsdcAmount: order.actualUsdcAmount !== undefined ? BigInt(order.actualUsdcAmount) : undefined,
          actualFiatAmount: order.actualFiatAmount !== undefined ? BigInt(order.actualFiatAmount) : undefined,
          quote: {
            ...order.quote,
            // JSON has no bigint; amounts were written as decimal strings.
            send: reviveMoney(order.quote.send),
            fee: reviveMoney(order.quote.fee),
            total: reviveMoney(order.quote.total),
            receive: reviveMoney(order.quote.receive),
            lockedAt: new Date(order.quote.lockedAt),
            expiresAt: new Date(order.quote.expiresAt),
          },
        }) as unknown as T
    );
  } catch {
    return [];
  }
}

export function writeOrders<T extends StorableOrder>(key: string, orders: T[]): void {
  localStorage.setItem(
    key,
    JSON.stringify(orders, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
  );
}
