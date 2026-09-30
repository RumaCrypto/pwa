"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, WalletClient } from "viem";

import type { Contact } from "@/lib/contacts/contacts";
import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { getP2pOrders } from "./p2p-orders";
import { placeSellOrder } from "./order-execution";
import type { Order } from "./orders";
import type { Quote } from "./quote";
import { readOrders, writeOrders } from "./order-storage";

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

const readSendOrders = () => readOrders<Order>(ORDERS_KEY);
const writeSendOrders = (orders: Order[]) => writeOrders(ORDERS_KEY, orders);

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
      // The on-chain id the SDK assigns when placing the order — the same
      // id a merchant sees and accepts against, so it doubles as this app's
      // order id rather than a locally-generated placeholder.
      id: p2pOrderId.toString(),
      contactId: contact.id,
      quote: placed,
      createdAt: new Date(),
      p2pOrderId,
      placeTxHash: txHash,
      phase: "awaiting_merchant",
    };
    writeSendOrders([order, ...readSendOrders()]);
    return order;
  }, []);

  const getOrder = useCallback((id: string) => readSendOrders().find((order) => order.id === id), []);

  const updateOrder = useCallback((id: string, patch: Partial<Order>) => {
    const orders = readSendOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return undefined;

    orders[index] = { ...orders[index], ...patch };
    writeSendOrders(orders);
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
