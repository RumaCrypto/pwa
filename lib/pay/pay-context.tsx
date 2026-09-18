"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, WalletClient } from "viem";

import { getP2pOrders } from "@/lib/send/p2p-orders";
import { submitPayoutAddress } from "@/lib/send/order-execution";
import { placePayOrder } from "./order-execution";
import { payCurrencyForCountry } from "./quote";
import type { Order } from "./orders";
import type { PayQuote } from "./quote";

const ORDERS_KEY = "ruma-pay-orders";

/** Local currencies all use 2 decimals; p2p.me amounts are always 6-decimal bigints. */
const TO_SDK_SCALE = 10_000n;

export interface PlacePayOrderParams {
  quote: PayQuote;
  walletClient: WalletClient;
  userAddress: Address;
}

export interface SubmitScannedAddressParams {
  orderId: string;
  /** Parsed from the business' QR — where the accepted merchant should send fiat. */
  paymentAddress: string;
  walletClient: WalletClient;
}

interface PayContextType {
  quote: PayQuote | null;
  setQuote: (quote: PayQuote | null) => void;
  /** Places the PAY order on-chain, then persists it and returns it. */
  placeOrder: (params: PlacePayOrderParams) => Promise<Order>;
  getOrder: (id: string) => Order | undefined;
  /** Merges a patch into a stored order — used as the tracking screen polls real status. */
  updateOrder: (id: string, patch: Partial<Order>) => Order | undefined;
  /**
   * Sends the QR's payment address to the accepted merchant, encrypted for
   * their public key, then advances the order to "awaiting_completion".
   * Only valid once `useOrderTracking` has moved the order to "awaiting_scan"
   * — that's what fills in `merchantPubkey` and `pendingFiatAmount`.
   */
  submitScannedAddress: (params: SubmitScannedAddressParams) => Promise<Order>;
  reset: () => void;
}

const PayContext = createContext<PayContextType | undefined>(undefined);

type SerialisedMoney = { amount: string; currency: PayQuote["local"]["currency"] };

function reviveMoney(value: unknown): PayQuote["local"] {
  const money = value as SerialisedMoney;
  return { amount: BigInt(money.amount), currency: money.currency };
}

type StoredOrder = Omit<
  Order,
  "createdAt" | "completedAt" | "quote" | "p2pOrderId" | "pendingFiatAmount" | "actualUsdcAmount" | "actualFiatAmount"
> & {
  createdAt: string;
  completedAt?: string;
  p2pOrderId: string;
  pendingFiatAmount?: string;
  actualUsdcAmount?: string;
  actualFiatAmount?: string;
  quote: Omit<PayQuote, "local" | "usdc" | "fee" | "total"> & {
    local: SerialisedMoney;
    usdc: SerialisedMoney;
    fee: SerialisedMoney;
    total: SerialisedMoney;
  };
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
      pendingFiatAmount: order.pendingFiatAmount !== undefined ? BigInt(order.pendingFiatAmount) : undefined,
      actualUsdcAmount: order.actualUsdcAmount !== undefined ? BigInt(order.actualUsdcAmount) : undefined,
      actualFiatAmount: order.actualFiatAmount !== undefined ? BigInt(order.actualFiatAmount) : undefined,
      quote: {
        ...order.quote,
        // JSON has no bigint; amounts were written as decimal strings.
        local: reviveMoney(order.quote.local),
        usdc: reviveMoney(order.quote.usdc),
        fee: reviveMoney(order.quote.fee),
        total: reviveMoney(order.quote.total),
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

export function PayProvider({ children }: { children: ReactNode }) {
  const [quote, setQuote] = useState<PayQuote | null>(null);

  const placeOrder = useCallback(async ({ quote: placed, walletClient, userAddress }: PlacePayOrderParams) => {
    // Consistent by construction: `usdc` was derived from `local` via the
    // same locked rate, so the pair won't trip the contract's slippage check.
    // The fee isn't a real on-chain charge yet — only `usdc` is actually sold, not `total`.
    const usdcAmount = placed.usdc.amount * TO_SDK_SCALE;
    const fiatAmount = placed.local.amount * TO_SDK_SCALE;

    const { orderId: p2pOrderId, txHash } = await placePayOrder({
      orders: getP2pOrders(),
      walletClient,
      userAddress,
      currency: payCurrencyForCountry(placed.country),
      usdcAmount,
      fiatAmount,
    });

    const order: Order = {
      // The on-chain id the SDK assigns when placing the order — the same id
      // a merchant sees and accepts against, so it doubles as this app's
      // order id rather than a locally-generated placeholder.
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

  const submitScannedAddress = useCallback(
    async ({ orderId, paymentAddress, walletClient }: SubmitScannedAddressParams) => {
      const orders = readOrders();
      const index = orders.findIndex((order) => order.id === orderId);
      const order = orders[index];
      if (!order) throw new Error(`Order ${orderId} not found`);
      if (!order.merchantPubkey) throw new Error("No merchant has accepted this order yet");

      await submitPayoutAddress({
        orders: getP2pOrders(),
        walletClient,
        orderId: order.p2pOrderId,
        merchantPublicKey: order.merchantPubkey,
        updatedAmount: order.pendingFiatAmount ?? 0n,
        paymentAddress,
      });

      orders[index] = { ...order, phase: "awaiting_completion", paymentAddress };
      writeOrders(orders);
      return orders[index];
    },
    []
  );

  const reset = useCallback(() => {
    setQuote(null);
  }, []);

  const value = useMemo(
    () => ({ quote, setQuote, placeOrder, getOrder, updateOrder, submitScannedAddress, reset }),
    [quote, placeOrder, getOrder, updateOrder, submitScannedAddress, reset]
  );

  return <PayContext.Provider value={value}>{children}</PayContext.Provider>;
}

export function usePay() {
  const context = useContext(PayContext);
  if (!context) {
    throw new Error("usePay must be used within PayProvider");
  }
  return context;
}
