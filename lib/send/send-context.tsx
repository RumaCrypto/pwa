"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { isAddress, type Address, type WalletClient } from "viem";

import type { Contact } from "@/lib/contacts/contacts";
import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { getP2pOrders } from "./p2p-orders";
import { placeSellOrder, sendUsdcTransfer } from "./order-execution";
import type { Order, P2pOrder, RumaTransferOrder } from "./orders";
import type { Quote } from "./quote";

const ORDERS_KEY = "ruma-orders";

/** Local currencies all use 2 decimals; p2p.me amounts are always 6-decimal bigints. */
const TO_SDK_SCALE = 10_000n;

/** `networkFeeWei` only exists on Ruma transfers, so `Partial<Order>` (shared keys only) can't carry it. */
export type OrderPatch = Partial<Order> & { networkFeeWei?: bigint };

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
  updateOrder: (id: string, patch: OrderPatch) => Order | undefined;
  reset: () => void;
}

const SendContext = createContext<SendContextType | undefined>(undefined);

type SerialisedMoney = { amount: string; currency: Quote["send"]["currency"] };

function reviveMoney(value: unknown): Quote["send"] {
  const money = value as SerialisedMoney;
  return { amount: BigInt(money.amount), currency: money.currency };
}

type StoredQuote = Omit<Quote, "lockedAt" | "expiresAt"> & { lockedAt: string; expiresAt: string };
type StoredCommon = "createdAt" | "completedAt" | "quote" | "actualUsdcAmount" | "actualFiatAmount";

type StoredOrder =
  | (Omit<P2pOrder, StoredCommon | "p2pOrderId"> & {
      createdAt: string;
      completedAt?: string;
      p2pOrderId: string;
      actualUsdcAmount?: string;
      actualFiatAmount?: string;
      quote: StoredQuote;
    })
  | (Omit<RumaTransferOrder, StoredCommon | "networkFeeWei"> & {
      networkFeeWei?: string;
      createdAt: string;
      completedAt?: string;
      actualUsdcAmount?: string;
      actualFiatAmount?: string;
      quote: StoredQuote;
    });

function reviveQuote(quote: StoredQuote): Quote {
  return {
    ...quote,
    // JSON has no bigint; amounts were written as decimal strings.
    send: reviveMoney(quote.send),
    fee: reviveMoney(quote.fee),
    total: reviveMoney(quote.total),
    receive: reviveMoney(quote.receive),
    lockedAt: new Date(quote.lockedAt),
    expiresAt: new Date(quote.expiresAt),
  };
}

function readOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];

    return (JSON.parse(raw) as StoredOrder[]).map((order): Order => {
      // Built field-by-field (rather than `{ ...order }`) so this stays a
      // single concrete object type instead of TS collapsing the spread of
      // `order`'s union into one merged, undiscriminated shape.
      const common = {
        id: order.id,
        contactId: order.contactId,
        quote: reviveQuote(order.quote),
        createdAt: new Date(order.createdAt),
        placeTxHash: order.placeTxHash,
        phase: order.phase,
        failureReason: order.failureReason,
        errorMessage: order.errorMessage,
        acceptedMerchant: order.acceptedMerchant,
        actualUsdcAmount: order.actualUsdcAmount !== undefined ? BigInt(order.actualUsdcAmount) : undefined,
        actualFiatAmount: order.actualFiatAmount !== undefined ? BigInt(order.actualFiatAmount) : undefined,
        completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
      };

      if (order.kind === "p2p") return { ...common, kind: "p2p", p2pOrderId: BigInt(order.p2pOrderId) };
      return {
        ...common,
        kind: "ruma",
        networkFeeWei: order.networkFeeWei !== undefined ? BigInt(order.networkFeeWei) : undefined,
      };
    });
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

/**
 * Merges a patch into an order, re-pinning `kind` explicitly afterwards.
 * `Partial<Order>` only ever touches the fields shared by both variants, but
 * spreading `order`'s union type directly would otherwise let TS collapse
 * the result into one undiscriminated shape instead of a real `Order`.
 */
function applyOrderPatch(order: Order, patch: OrderPatch): Order {
  if (order.kind === "p2p") return { ...order, ...patch, kind: "p2p" };
  return { ...order, ...patch, kind: "ruma" };
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

    // A "Has Ruma" contact is paid with a plain USDC transfer to their own
    // wallet — both sides already hold USDC, so there's no fiat leg, no
    // merchant, and no p2p.me sell order to place.
    if (contact.payout.kind === "ruma") {
      const to = contact.payout.reference;
      if (!isAddress(to)) throw new Error("This contact's Ruma address looks invalid.");

      const txHash = await sendUsdcTransfer({ walletClient, userAddress, to, usdcAmount });

      const order: Order = {
        kind: "ruma",
        // No on-chain order id exists for a direct transfer, so the tx hash
        // doubles as this app's order id.
        id: txHash,
        contactId: contact.id,
        quote: placed,
        createdAt: new Date(),
        placeTxHash: txHash,
        // Confirmed later, by `useOrderTracking`, once the receipt lands.
        phase: "awaiting_completion",
        actualUsdcAmount: usdcAmount,
      };
      writeOrders([order, ...readOrders()]);
      return order;
    }

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
      kind: "p2p",
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
    writeOrders([order, ...readOrders()]);
    return order;
  }, []);

  const getOrder = useCallback((id: string) => readOrders().find((order) => order.id === id), []);

  const updateOrder = useCallback((id: string, patch: OrderPatch) => {
    const orders = readOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return undefined;

    orders[index] = applyOrderPatch(orders[index], patch);
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
