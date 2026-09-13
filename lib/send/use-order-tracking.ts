"use client";

import { useEffect, useRef } from "react";

import type { Contact } from "@/lib/contacts/contacts";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import { getP2pOrders } from "./p2p-orders";
import { submitPayoutAddress } from "./order-execution";
import { isTerminal, type Order } from "./orders";

const POLL_MS = 4000;
/** No merchant matched the order in time. */
const MERCHANT_TIMEOUT_MS = 10 * 60_000;
/** Merchant accepted and has the payout details; waiting for them to pay and settle. */
const COMPLETION_TIMEOUT_MS = 30 * 60_000;

/**
 * Polls a placed sell order until it settles, submitting the contact's
 * encrypted payout address the moment a merchant accepts. Safe to mount
 * against an order at any non-terminal phase — e.g. after a page reload.
 */
export function useOrderTracking(
  order: Order | null | undefined,
  contact: Contact | undefined,
  updateOrder: (id: string, patch: Partial<Order>) => Order | undefined
): void {
  const getWalletClient = useP2pWalletClient();
  const payoutSubmitting = useRef(false);

  useEffect(() => {
    if (!order || !contact || isTerminal(order)) return;

    const currentOrder = order;
    const currentContact = contact;
    let stopped = false;
    const deadline =
      Date.now() + (currentOrder.phase === "awaiting_completion" ? COMPLETION_TIMEOUT_MS : MERCHANT_TIMEOUT_MS);

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

      if (fetched.status === "accepted" && currentOrder.phase === "awaiting_merchant" && !payoutSubmitting.current) {
        payoutSubmitting.current = true;
        updateOrder(currentOrder.id, { acceptedMerchant: fetched.acceptedMerchant });

        try {
          const { walletClient } = await getWalletClient();
          await submitPayoutAddress({
            orders: getP2pOrders(),
            walletClient,
            orderId: currentOrder.p2pOrderId,
            merchantPublicKey: fetched.pubkey,
            updatedAmount: fetched.fiatAmount,
            paymentAddress: currentContact.payout.reference,
          });
          updateOrder(currentOrder.id, { phase: "awaiting_completion" });
        } catch (err) {
          updateOrder(currentOrder.id, {
            phase: "failed",
            failureReason: "error",
            errorMessage: err instanceof Error ? err.message : "Could not send the payout details.",
          });
          return;
        }
      }

      schedule();
    }

    tick();
    return () => {
      stopped = true;
    };
  }, [order, contact, getWalletClient, updateOrder]);
}
