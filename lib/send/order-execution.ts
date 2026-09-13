import type { ExecuteBase, OrdersClient } from "@p2pdotme/sdk/orders";
import type { CurrencyCode as SdkCurrencyCode } from "@p2pdotme/sdk/country";
import type { Address, WalletClient } from "viem";

import { p2pProfile } from "./p2p-profile";

/** Numeric order-type codes the diamond contract expects. Sell is the only one this app places. */
const SELL_ORDER_TYPE = 1;

/**
 * The SDK bundles its own pinned `viem` (2.47.6); pwa depends on a newer
 * `viem` (^2.56.3) directly. pnpm keeps the two separate, so their
 * `WalletClient` types are structurally identical but nominally distinct to
 * TypeScript. The runtime shape is the same — cast at this one seam rather
 * than pinning pwa's viem down to match the SDK's.
 */
function toSdkWalletClient(client: WalletClient): ExecuteBase["walletClient"] {
  return client as unknown as ExecuteBase["walletClient"];
}

export interface PlaceSellOrderParams {
  orders: OrdersClient;
  walletClient: WalletClient;
  userAddress: Address;
  currency: SdkCurrencyCode;
  /** 6-decimal bigint — the USDC actually sold, mirroring `quote.send`. */
  usdcAmount: bigint;
  /** 6-decimal bigint — the fiat promised, mirroring `quote.receive`. */
  fiatAmount: bigint;
}

export interface PlaceSellOrderResult {
  orderId: bigint;
  txHash: `0x${string}`;
}

/**
 * Approves the diamond for `usdcAmount` if the current allowance falls
 * short, then places the sell order. `recipientAddr` is the user's own
 * address — the contact's actual payout details aren't known on-chain yet;
 * they're attached later via `submitPayoutAddress` once a merchant accepts.
 */
export async function placeSellOrder({
  orders,
  walletClient,
  userAddress,
  currency,
  usdcAmount,
  fiatAmount,
}: PlaceSellOrderParams): Promise<PlaceSellOrderResult> {
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
    orderType: SELL_ORDER_TYPE,
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

export interface SubmitPayoutAddressParams {
  orders: OrdersClient;
  walletClient: WalletClient;
  orderId: bigint;
  /** The accepted merchant's public key, from `Order.pubkey`. */
  merchantPublicKey: string;
  /** The order's current fiat amount, from `Order.fiatAmount`. */
  updatedAmount: bigint;
  /** The contact's payout reference (Pix key, Nequi phone, bank account, ...). */
  paymentAddress: string;
}

/**
 * Encrypts the contact's payout reference for the accepted merchant and
 * publishes it on the order, so the merchant knows where to send the fiat.
 * The signing identity is resolved (and, on first use, created) internally
 * from the `relayIdentityStore` the orders client was configured with.
 */
export async function submitPayoutAddress({
  orders,
  walletClient,
  orderId,
  merchantPublicKey,
  updatedAmount,
  paymentAddress,
}: SubmitPayoutAddressParams): Promise<void> {
  const encryptedResult = await orders.encryptPaymentAddress({
    paymentAddress,
    recipientPublicKey: merchantPublicKey,
  });
  if (encryptedResult.isErr()) throw encryptedResult.error;

  const setUpiResult = await orders.setSellOrderUpi.execute({
    orderId,
    paymentAddress: encryptedResult.value,
    merchantPublicKey,
    updatedAmount,
    walletClient: toSdkWalletClient(walletClient),
    waitForReceipt: true,
  });
  if (setUpiResult.isErr()) throw setUpiResult.error;
}
