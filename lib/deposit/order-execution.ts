import type { ExecuteBase, OrdersClient } from "@p2pdotme/sdk/orders";
import type { CurrencyCode as SdkCurrencyCode } from "@p2pdotme/sdk/country";
import type { Address, WalletClient } from "viem";

/** Numeric order-type code the diamond contract expects for a BUY order. */
const BUY_ORDER_TYPE = 0;

/**
 * Same seam as `lib/send/order-execution.ts`: the SDK bundles its own pinned
 * `viem`, structurally identical to pwa's but nominally distinct to TypeScript.
 */
function toSdkWalletClient(client: WalletClient): ExecuteBase["walletClient"] {
  return client as unknown as ExecuteBase["walletClient"];
}

export interface PlaceBuyOrderParams {
  orders: OrdersClient;
  walletClient: WalletClient;
  userAddress: Address;
  currency: SdkCurrencyCode;
  /** 6-decimal bigint — the USDC the user will receive, mirroring `quote.usdc`. */
  usdcAmount: bigint;
  /** 6-decimal bigint — the fiat the user promises to send, mirroring `quote.local`. */
  fiatAmount: bigint;
}

export interface PlaceBuyOrderResult {
  orderId: bigint;
  txHash: `0x${string}`;
}

/**
 * Places a BUY order. Unlike a SELL or PAY order, no USDC leaves the user's
 * balance up front — a seller funds the escrow once they accept — so there's
 * no allowance to check or approve here, only the placement itself.
 * `recipientAddr` is the user's own address: it's where the USDC actually
 * lands once the order completes.
 */
export async function placeBuyOrder({
  orders,
  walletClient,
  userAddress,
  currency,
  usdcAmount,
  fiatAmount,
}: PlaceBuyOrderParams): Promise<PlaceBuyOrderResult> {
  const placeResult = await orders.placeOrder.execute({
    orderType: BUY_ORDER_TYPE,
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

export interface ConfirmBuyOrderPaidParams {
  orders: OrdersClient;
  walletClient: WalletClient;
  orderId: bigint;
}

export interface ConfirmBuyOrderPaidResult {
  txHash: `0x${string}`;
}

/**
 * Tells the protocol the user has sent the fiat to the seller's decrypted
 * payment address. This is what unlocks the seller's side of the escrow once
 * they, in turn, confirm receipt.
 */
export async function confirmBuyOrderPaid({
  orders,
  walletClient,
  orderId,
}: ConfirmBuyOrderPaidParams): Promise<ConfirmBuyOrderPaidResult> {
  const result = await orders.paidBuyOrder.execute({
    orderId,
    walletClient: toSdkWalletClient(walletClient),
    waitForReceipt: true,
  });
  if (result.isErr()) throw result.error;

  return { txHash: result.value.hash };
}
