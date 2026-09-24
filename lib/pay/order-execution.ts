import type { ExecuteBase, OrdersClient } from "@p2pdotme/sdk/orders";
import type { CurrencyCode as SdkCurrencyCode } from "@p2pdotme/sdk/country";
import type { Address, WalletClient } from "viem";

import { p2pProfile } from "@/lib/send/p2p-profile";

/** Numeric order-type code the diamond contract expects for a QR-pay order. */
const PAY_ORDER_TYPE = 2;

/**
 * Same seam as `lib/send/order-execution.ts`: the SDK bundles its own pinned
 * `viem`, structurally identical to pwa's but nominally distinct to TypeScript.
 */
function toSdkWalletClient(client: WalletClient): ExecuteBase["walletClient"] {
  return client as unknown as ExecuteBase["walletClient"];
}

export interface PlacePayOrderParams {
  orders: OrdersClient;
  walletClient: WalletClient;
  userAddress: Address;
  currency: SdkCurrencyCode;
  /** 6-decimal bigint — the USDC debited, mirroring `quote.usdc`. */
  usdcAmount: bigint;
  /** 6-decimal bigint — the local fiat the QR is asking for, mirroring `quote.local`. */
  fiatAmount: bigint;
}

export interface PlacePayOrderResult {
  orderId: bigint;
  txHash: `0x${string}`;
}

/**
 * Approves the diamond for `usdcAmount` if the current allowance falls
 * short, then places the PAY order. The merchant's payment address (parsed
 * from the scanned QR) isn't known on-chain yet — it's attached later via
 * `setSellOrderUpi` once a merchant accepts, exactly like a SELL order's
 * payout address. `recipientAddr` is the user's own address for the same
 * reason `placeSellOrder` uses it: the real destination isn't an on-chain
 * account at all, it's whatever the QR encodes.
 */
export async function placePayOrder({
  orders,
  walletClient,
  userAddress,
  currency,
  usdcAmount,
  fiatAmount,
}: PlacePayOrderParams): Promise<PlacePayOrderResult> {
  const allowanceResult = await p2pProfile.getUsdcAllowance({ owner: userAddress });
  if (allowanceResult.isErr()) throw allowanceResult.error;

  if (allowanceResult.value < usdcAmount) {
    const approveResult = await orders.approveUsdc.execute({
      amount: usdcAmount,
      walletClient: toSdkWalletClient(walletClient),
      waitForReceipt: true,
    });
    if (approveResult.isErr()) throw approveResult.error;
  }

  const placeResult = await orders.placeOrder.execute({
    orderType: PAY_ORDER_TYPE,
    currency,
    user: userAddress,
    amount: usdcAmount,
    fiatAmount,
    recipientAddr: userAddress,
    walletClient: toSdkWalletClient(walletClient),
    waitForReceipt: true,
  });
  if (placeResult.isErr()) throw placeResult.error;

  const orderId = placeResult.value.meta?.orderId;
  if (orderId === undefined) {
    throw new Error("Order was placed but its id could not be read from the transaction receipt");
  }
  return { orderId, txHash: placeResult.value.hash };
}
