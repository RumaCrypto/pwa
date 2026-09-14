"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { canCancel, newOrderId, type Order } from "./orders";
import type { Quote } from "./quote";

const ORDERS_KEY = "ruma-orders";

interface SendContextType {
  /** The recipient chosen in step one, held across the three steps. */
  contactId: string | null;
  setContactId: (id: string | null) => void;
  /** The typed amount, as the keypad's canonical digits-and-dot string. */
  draft: string;
  setDraft: (draft: string) => void;
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
  placeOrder: (quote: Quote, contactId: string) => Order;
  getOrder: (id: string) => Order | undefined;
  /** Stops an in-flight transfer and returns the updated order. */
  cancelOrder: (id: string) => Order | undefined;
  reset: () => void;
}

const SendContext = createContext<SendContextType | undefined>(undefined);

type StoredOrder = Omit<Order, "createdAt" | "cancelledAt" | "quote"> & {
  createdAt: string;
  cancelledAt?: string;
  quote: Omit<Quote, "lockedAt" | "expiresAt"> & { lockedAt: string; expiresAt: string };
};

function readOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];

    return (JSON.parse(raw) as StoredOrder[]).map((order) => ({
      ...order,
      createdAt: new Date(order.createdAt),
      cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : undefined,
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

type SerialisedMoney = { amount: string; currency: Quote["send"]["currency"] };

function reviveMoney(value: unknown): Quote["send"] {
  const money = value as SerialisedMoney;
  return { amount: BigInt(money.amount), currency: money.currency };
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

  const placeOrder = useCallback((placed: Quote, contact: string) => {
    const order: Order = {
      id: newOrderId(),
      contactId: contact,
      quote: placed,
      createdAt: new Date(),
    };
    writeOrders([order, ...readOrders()]);
    return order;
  }, []);

  const getOrder = useCallback((id: string) => readOrders().find((order) => order.id === id), []);

  const cancelOrder = useCallback((id: string) => {
    const orders = readOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1 || !canCancel(orders[index])) return orders[index];

    orders[index] = { ...orders[index], cancelledAt: new Date() };
    writeOrders(orders);
    return orders[index];
  }, []);

  const reset = useCallback(() => {
    setContactId(null);
    setDraft("");
    setQuote(null);
  }, []);

  const value = useMemo(
    () => ({ contactId, setContactId, draft, setDraft, quote, setQuote, placeOrder, getOrder, cancelOrder, reset }),
    [contactId, draft, quote, placeOrder, getOrder, cancelOrder, reset]
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
