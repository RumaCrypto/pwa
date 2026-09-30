"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, WalletClient } from "viem";

import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { getP2pOrders } from "@/lib/send/p2p-orders";
import { placeSellOrder } from "@/lib/send/order-execution";
import { readOrders, writeOrders, type StorableOrder } from "@/lib/send/order-storage";
import type { Quote } from "@/lib/send/quote";
import type { Order } from "@/lib/send/orders";

const ORDERS_KEY = "ruma-withdraw-orders";

/** Local currencies all use 2 decimals; p2p.me amounts are always 6-decimal bigints. */
const TO_SDK_SCALE = 10_000n;

/** A sell order placed to cash out to the user's own local payment method. */
export interface WithdrawOrder extends StorableOrder {
  id: string;
  country: string;
  /** Packed local-method reference the merchant is paid to. */
  payoutReference: string;
}

export interface PlaceWithdrawParams {
  quote: Quote;
  country: string;
  payoutReference: string;
  walletClient: WalletClient;
  userAddress: Address;
}

interface WithdrawContextType {
  /** Local payment field values entered in step one, held across the steps. */
  details: Record<string, string>;
  setDetails: (details: Record<string, string>) => void;
  /** The typed amount, as the keypad's canonical digits-and-dot string. */
  draft: string;
  setDraft: (draft: string) => void;
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
  placeOrder: (params: PlaceWithdrawParams) => Promise<WithdrawOrder>;
  getOrder: (id: string) => WithdrawOrder | undefined;
  updateOrder: (id: string, patch: Partial<Order>) => WithdrawOrder | undefined;
  reset: () => void;
}

const WithdrawContext = createContext<WithdrawContextType | undefined>(undefined);

const readWithdrawals = () => readOrders<WithdrawOrder>(ORDERS_KEY);

export function WithdrawProvider({ children }: { children: ReactNode }) {
  const [details, setDetails] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);

  const placeOrder = useCallback(
    async ({ quote: placed, country, payoutReference, walletClient, userAddress }: PlaceWithdrawParams) => {
      // As in send: only `send` is actually sold; the fee line isn't an on-chain charge yet.
      const { orderId: p2pOrderId, txHash } = await placeSellOrder({
        orders: getP2pOrders(),
        walletClient,
        userAddress,
        currency: sdkCurrencyForCountry(country),
        usdcAmount: placed.send.amount * TO_SDK_SCALE,
        fiatAmount: placed.receive.amount * TO_SDK_SCALE,
      });

      const order: WithdrawOrder = {
        id: p2pOrderId.toString(),
        country,
        payoutReference,
        quote: placed,
        createdAt: new Date(),
        p2pOrderId,
        placeTxHash: txHash,
        phase: "awaiting_merchant",
      };
      writeOrders(ORDERS_KEY, [order, ...readWithdrawals()]);
      return order;
    },
    []
  );

  const getOrder = useCallback((id: string) => readWithdrawals().find((order) => order.id === id), []);

  const updateOrder = useCallback((id: string, patch: Partial<Order>) => {
    const orders = readWithdrawals();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return undefined;

    orders[index] = { ...orders[index], ...patch };
    writeOrders(ORDERS_KEY, orders);
    return orders[index];
  }, []);

  const reset = useCallback(() => {
    setDetails({});
    setDraft("");
    setQuote(null);
  }, []);

  const value = useMemo(
    () => ({ details, setDetails, draft, setDraft, quote, setQuote, placeOrder, getOrder, updateOrder, reset }),
    [details, draft, quote, placeOrder, getOrder, updateOrder, reset]
  );

  return <WithdrawContext.Provider value={value}>{children}</WithdrawContext.Provider>;
}

export function useWithdraw() {
  const context = useContext(WithdrawContext);
  if (!context) {
    throw new Error("useWithdraw must be used within WithdrawProvider");
  }
  return context;
}
