"use client";

import { useEffect, useRef } from "react";

import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import { baseClient } from "@/lib/viem";
import { getP2pOrders } from "./p2p-orders";
import { confirmUsdcTransfer, submitPayoutAddress } from "./order-execution";
import { isTerminal, type P2pOrder, type RumaTransferOrder } from "./orders";
import type { OrderPatch } from "./send-context";

const POLL_MS = 4000;
/** No merchant matched the order in time. */
const MERCHANT_TIMEOUT_MS = 10 * 60_000;
/** Merchant accepted and has the payout details; waiting for them to pay and settle. */
const COMPLETION_TIMEOUT_MS = 30 * 60_000;

/** The slice of an order the tracker reads, so withdrawals (which have no contact) can share it. */
export type TrackedOrder = Omit<P2pOrder, "contactId"> | Omit<RumaTransferOrder, "contactId">;

/**
 * Polls a placed sell order until it settles, submitting the contact's
 * encrypted payout address the moment a merchant accepts. Safe to mount
 * against an order at any non-terminal phase — e.g. after a page reload.
 */
export function useOrderTracking(
  order: TrackedOrder | null | undefined,
  /** Where the fiat should land: a contact's payout reference, or the user's saved withdrawal details. */
  payoutReference: string | undefined,
  updateOrder: (id: string, patch: OrderPatch) => unknown
): void {
  const getWalletClient = useP2pWalletClient();
  const payoutSubmitting = useRef(false);

  // A Ruma transfer is already on the network when its order exists; all
  // that's left is waiting for the receipt. Safe after a reload too, since
  // the hash is persisted with the order.
  useEffect(() => {
    if (!order || order.kind !== "ruma" || isTerminal(order)) return;

    const { id, placeTxHash } = order;
    let stopped = false;

    confirmUsdcTransfer(placeTxHash, baseClient.waitForTransactionReceipt)
      .then(({ feeWei }) => {
        if (!stopped) updateOrder(id, { phase: "completed", completedAt: new Date(), networkFeeWei: feeWei });
      })
      .catch((err) => {
        if (stopped) return;
        updateOrder(id, {
          phase: "failed",
          failureReason: "error",
          errorMessage: err instanceof Error ? err.message : "The transfer could not be confirmed.",
        });
      });

    return () => {
      stopped = true;
    };
  }, [order, updateOrder]);

  useEffect(() => {
    // Only p2p.me sell orders are polled; Ruma transfers are handled above.
    if (!order || !payoutReference || isTerminal(order) || order.kind !== "p2p") return;

    const currentOrder = order;
    const currentPayoutReference = payoutReference;
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
            paymentAddress: currentPayoutReference,
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
  }, [order, payoutReference, getWalletClient, updateOrder]);
}
