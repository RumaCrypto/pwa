"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, WalletClient } from "viem";

import type { Contact } from "@/lib/contacts/contacts";
import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { getP2pOrders } from "./p2p-orders";
import { placeSellOrder } from "./order-execution";
import { newOrderId, type Order } from "./orders";
import type { Quote } from "./quote";

const ORDERS_KEY = "ruma-orders";

/** Local currencies all use 2 decimals; p2p.me amounts are always 6-decimal bigints. */
const TO_SDK_SCALE = 10_000n;

export interface PlaceOrderParams {
  quote: Quote;
  contact: Contact;
  walletClient: WalletClient;
  userAddress: Address;
}

interface SendContextType {
  /** The recipient chosen in step one, held across the three steps. */
  contactId: string | null;
  setContactId: (id: string | null) => void;
  /** The typed amount, as the keypad's canonical digits-and-dot string. */
  draft: string;
  setDraft: (draft: string) => void;
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
  /** Places the sell order on-chain, then persists it and returns it. */
  placeOrder: (params: PlaceOrderParams) => Promise<Order>;
  getOrder: (id: string) => Order | undefined;
  /** Merges a patch into a stored order — used as the tracking screen polls real status. */
  updateOrder: (id: string, patch: Partial<Order>) => Order | undefined;
  reset: () => void;
}

const SendContext = createContext<SendContextType | undefined>(undefined);

type SerialisedMoney = { amount: string; currency: Quote["send"]["currency"] };

function reviveMoney(value: unknown): Quote["send"] {
  const money = value as SerialisedMoney;
  return { amount: BigInt(money.amount), currency: money.currency };
}

type StoredOrder = Omit<Order, "createdAt" | "completedAt" | "quote" | "p2pOrderId" | "actualUsdcAmount" | "actualFiatAmount"> & {
  createdAt: string;
  completedAt?: string;
  p2pOrderId: string;
  actualUsdcAmount?: string;
  actualFiatAmount?: string;
  quote: Omit<Quote, "lockedAt" | "expiresAt"> & { lockedAt: string; expiresAt: string };
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
        send: reviveMoney(order.quote.send),
        fee: reviveMoney(order.quote.fee),
        total: reviveMoney(order.quote.total),
        receive: reviveMoney(order.quote.receive),
        lockedAt: new Date(order.quote.lockedAt),
        expiresAt: new Date(order.quote.expiresAt),
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

export function SendProvider({ children }: { children: ReactNode }) {
  const [contactId, setContactId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);

  const placeOrder = useCallback(async ({ quote: placed, contact, walletClient, userAddress }: PlaceOrderParams) => {
    // Consistent by construction: `receive` was derived from `send` via the
    // same locked rate, so the pair won't trip the contract's slippage check.
    // The transfer-cost line isn't a real on-chain charge yet — only `send`
    // is actually sold, not `total`.
    const usdcAmount = placed.send.amount * TO_SDK_SCALE;
    const fiatAmount = placed.receive.amount * TO_SDK_SCALE;

    const { orderId: p2pOrderId, txHash } = await placeSellOrder({
      orders: getP2pOrders(),
      walletClient,
      userAddress,
      currency: sdkCurrencyForCountry(contact.country),
      usdcAmount,
      fiatAmount,
    });

    const order: Order = {
      id: newOrderId(),
      contactId: contact.id,
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

  const reset = useCallback(() => {
    setContactId(null);
    setDraft("");
    setQuote(null);
  }, []);

  const value = useMemo(
    () => ({ contactId, setContactId, draft, setDraft, quote, setQuote, placeOrder, getOrder, updateOrder, reset }),
    [contactId, draft, quote, placeOrder, getOrder, updateOrder, reset]
  );

  return <SendContext.Provider value={value}>{children}</SendContext.Provider>;
}

export function useSend() {
  const context = useContext(SendContext);
  if (!context) {
    throw new Error("useSend must be used within SendProvider");
  }
  return context;
}
