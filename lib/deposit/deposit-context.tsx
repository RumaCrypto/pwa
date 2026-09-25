"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, WalletClient } from "viem";

import { getP2pOrders } from "@/lib/send/p2p-orders";
import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { placeBuyOrder, confirmBuyOrderPaid } from "./order-execution";
import type { DepositQuote } from "./quote";
import type { Order } from "./orders";

const ORDERS_KEY = "ruma-deposit-orders";

/** Local currencies all use 2 decimals; p2p.me amounts are always 6-decimal bigints. */
const TO_SDK_SCALE = 10_000n;

export interface PlaceDepositOrderParams {
  quote: DepositQuote;
  walletClient: WalletClient;
  userAddress: Address;
}

export interface MarkDepositOrderPaidParams {
  orderId: string;
  walletClient: WalletClient;
}

interface DepositContextType {
  quote: DepositQuote | null;
  setQuote: (quote: DepositQuote | null) => void;
  /** Places the BUY order on-chain, then persists it and returns it. */
  placeOrder: (params: PlaceDepositOrderParams) => Promise<Order>;
  getOrder: (id: string) => Order | undefined;
  /** Merges a patch into a stored order — used as the tracking screen polls real status. */
  updateOrder: (id: string, patch: Partial<Order>) => Order | undefined;
  /** Confirms the fiat was sent, then advances the order to "awaiting_completion". */
  markPaid: (params: MarkDepositOrderPaidParams) => Promise<Order>;
  reset: () => void;
}

const DepositContext = createContext<DepositContextType | undefined>(undefined);

type SerialisedMoney = { amount: string; currency: DepositQuote["local"]["currency"] };

function reviveMoney(value: unknown): DepositQuote["local"] {
  const money = value as SerialisedMoney;
  return { amount: BigInt(money.amount), currency: money.currency };
}

type StoredOrder = Omit<
  Order,
  "createdAt" | "completedAt" | "quote" | "p2pOrderId" | "actualUsdcAmount" | "actualFiatAmount"
> & {
  createdAt: string;
  completedAt?: string;
  p2pOrderId: string;
  actualUsdcAmount?: string;
  actualFiatAmount?: string;
  quote: Omit<DepositQuote, "local" | "usdc"> & { local: SerialisedMoney; usdc: SerialisedMoney };
};

function readOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];

    return (JSON.parse(raw) as StoredOrder[]).map((order) => ({
      ...order,
      createdAt: new Date(order.createdAt),
      completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
      p2pOrderId: BigInt(order.p2pOrderId),
      actualUsdcAmount: order.actualUsdcAmount !== undefined ? BigInt(order.actualUsdcAmount) : undefined,
      actualFiatAmount: order.actualFiatAmount !== undefined ? BigInt(order.actualFiatAmount) : undefined,
      quote: {
        ...order.quote,
        // JSON has no bigint; amounts were written as decimal strings.
        local: reviveMoney(order.quote.local),
        usdc: reviveMoney(order.quote.usdc),
      },
    }));
  } catch {
    return [];
  }
}

function writeOrders(orders: Order[]): void {
  localStorage.setItem(
    ORDERS_KEY,
    JSON.stringify(orders, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
  );
}

export function DepositProvider({ children }: { children: ReactNode }) {
  const [quote, setQuote] = useState<DepositQuote | null>(null);

  const placeOrder = useCallback(async ({ quote: placed, walletClient, userAddress }: PlaceDepositOrderParams) => {
    // Consistent by construction: `usdc` was derived from `local` via the
    // same locked rate, so the pair won't trip the contract's slippage check.
    const usdcAmount = placed.usdc.amount * TO_SDK_SCALE;
    const fiatAmount = placed.local.amount * TO_SDK_SCALE;

    const { orderId: p2pOrderId, txHash } = await placeBuyOrder({
      orders: getP2pOrders(),
      walletClient,
      userAddress,
      currency: sdkCurrencyForCountry(placed.country),
      usdcAmount,
      fiatAmount,
    });

    const order: Order = {
      // The on-chain id the SDK assigns when placing the order — the same id
      // a seller sees and accepts against, so it doubles as this app's order
      // id rather than a locally-generated placeholder.
      id: p2pOrderId.toString(),
      quote: placed,
      createdAt: new Date(),
      p2pOrderId,
      placeTxHash: txHash,
      phase: "awaiting_merchant",
    };
    writeOrders([order, ...readOrders()]);
    return order;
  }, []);

  const getOrder = useCallback((id: string) => readOrders().find((order) => order.id === id), []);

  const updateOrder = useCallback((id: string, patch: Partial<Order>) => {
    const orders = readOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return undefined;

    orders[index] = { ...orders[index], ...patch };
    writeOrders(orders);
    return orders[index];
  }, []);

  const markPaid = useCallback(async ({ orderId, walletClient }: MarkDepositOrderPaidParams) => {
    const orders = readOrders();
    const index = orders.findIndex((order) => order.id === orderId);
    const order = orders[index];
    if (!order) throw new Error(`Order ${orderId} not found`);

    const { txHash } = await confirmBuyOrderPaid({
      orders: getP2pOrders(),
      walletClient,
      orderId: order.p2pOrderId,
    });

    orders[index] = { ...order, phase: "awaiting_completion", paidTxHash: txHash };
    writeOrders(orders);
    return orders[index];
  }, []);

  const reset = useCallback(() => {
    setQuote(null);
  }, []);

  const value = useMemo(
    () => ({ quote, setQuote, placeOrder, getOrder, updateOrder, markPaid, reset }),
    [quote, placeOrder, getOrder, updateOrder, markPaid, reset]
  );

  return <DepositContext.Provider value={value}>{children}</DepositContext.Provider>;
}

export function useDeposit() {
  const context = useContext(DepositContext);
  if (!context) {
    throw new Error("useDeposit must be used within DepositProvider");
  }
  return context;
}
