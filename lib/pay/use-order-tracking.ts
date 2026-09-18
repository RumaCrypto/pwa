"use client";

import { useEffect } from "react";

import { getP2pOrders } from "@/lib/send/p2p-orders";
import { isTerminal, type Order } from "./orders";

const POLL_MS = 4000;
/** No merchant matched the order in time. */
const MERCHANT_TIMEOUT_MS = 10 * 60_000;
/** Merchant accepted; waiting on the user to scan the QR, then on the merchant to pay and settle. */
const COMPLETION_TIMEOUT_MS = 30 * 60_000;

/**
 * Polls a placed PAY order until it settles. Unlike a SELL order — where the
 * payout address is already known and gets submitted automatically the
 * moment a merchant accepts — a PAY order only learns its payment address
 * when the user scans the business' QR, which happens in the UI, not here.
 * This hook only ever moves the order from "awaiting_merchant" to
 * "awaiting_scan"; the scan step itself (and the transition to
 * "awaiting_completion") is driven by `usePay().submitScannedAddress`.
 * Safe to mount against an order at any non-terminal phase — e.g. after a
 * page reload.
 */
export function useOrderTracking(
  order: Order | null | undefined,
  updateOrder: (id: string, patch: Partial<Order>) => Order | undefined
): void {
  useEffect(() => {
    if (!order || isTerminal(order)) return;

    const currentOrder = order;
    let stopped = false;
    const deadline =
      Date.now() +
      (currentOrder.phase === "awaiting_merchant" ? MERCHANT_TIMEOUT_MS : COMPLETION_TIMEOUT_MS);

    function schedule() {
      if (!stopped) setTimeout(tick, POLL_MS);
    }

    async function tick() {
      if (stopped) return;

      if (Date.now() > deadline) {
        updateOrder(currentOrder.id, { phase: "failed", failureReason: "timeout" });
        return;
      }

      const result = await getP2pOrders().getOrder({ orderId: currentOrder.p2pOrderId });
      if (result.isErr()) {
        schedule();
        return;
      }
      const fetched = result.value;

      if (fetched.status === "cancelled") {
        updateOrder(currentOrder.id, { phase: "failed", failureReason: "cancelled" });
        return;
      }

      if (fetched.status === "completed") {
        updateOrder(currentOrder.id, {
          phase: "completed",
          acceptedMerchant: fetched.acceptedMerchant,
          actualUsdcAmount: fetched.actualUsdcAmount,
          actualFiatAmount: fetched.actualFiatAmount,
          completedAt: new Date(Number(fetched.completedAt) * 1000),
        });
        return;
      }

      if (fetched.status === "accepted" && currentOrder.phase === "awaiting_merchant") {
        updateOrder(currentOrder.id, {
          phase: "awaiting_scan",
          acceptedMerchant: fetched.acceptedMerchant,
          merchantPubkey: fetched.pubkey,
          pendingFiatAmount: fetched.fiatAmount,
        });
        return;
      }

      schedule();
    }

    tick();
    return () => {
      stopped = true;
    };
  }, [order, updateOrder]);
}
