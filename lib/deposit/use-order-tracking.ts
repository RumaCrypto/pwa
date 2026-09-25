"use client";

import { useEffect } from "react";

import { getP2pOrders } from "@/lib/send/p2p-orders";
import { isTerminal, type Order } from "./orders";

const POLL_MS = 4000;
/** No seller matched the order in time. */
const MERCHANT_TIMEOUT_MS = 10 * 60_000;
/** Seller accepted; waiting on the user to pay, then on the seller to confirm and settle. */
const COMPLETION_TIMEOUT_MS = 30 * 60_000;

/**
 * Polls a placed BUY order until it settles. A BUY order only learns its
 * seller's payment address once they accept and publish it (encrypted) — this
 * hook decrypts it the moment that happens and moves the order from
 * "awaiting_merchant" to "awaiting_payment". From there the user pays outside
 * the app and taps "I've paid" (`useDeposit().markPaid`), which moves the
 * order to "awaiting_completion"; this hook then just watches for the seller
 * confirming receipt. Safe to mount against an order at any non-terminal
 * phase — e.g. after a page reload.
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

      if (fetched.status === "accepted" && fetched.encUpi && currentOrder.phase === "awaiting_merchant") {
        const decrypted = await getP2pOrders().decryptPaymentAddress({ encrypted: fetched.encUpi });
        if (decrypted.isErr()) {
          updateOrder(currentOrder.id, {
            phase: "failed",
            failureReason: "error",
            errorMessage: decrypted.error.message,
          });
          return;
        }

        updateOrder(currentOrder.id, {
          phase: "awaiting_payment",
          acceptedMerchant: fetched.acceptedMerchant,
          paymentAddress: decrypted.value,
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
