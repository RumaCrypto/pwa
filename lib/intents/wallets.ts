/**
 * Whether `address` is one of the Ethereum wallets linked to a Privy user.
 * A user can link several, and the client's `user.wallet` (the recipient) may
 * not be the first, so any match counts. Pure, so it is testable without the SDK.
 */
export function ownsWallet(linkedAccounts: readonly unknown[], address: string): boolean {
  const target = address.toLowerCase();
  return ethereumWallets(linkedAccounts).some((wallet) => wallet.toLowerCase() === target);
}

/** Every Ethereum wallet linked to a Privy user, in Privy's order. */
export function ethereumWallets(linkedAccounts: readonly unknown[]): string[] {
  return linkedAccounts.flatMap((account) => {
    if (typeof account !== "object" || account === null) return [];
    const a = account as { type?: unknown; chain_type?: unknown; address?: unknown };
    return a.type === "wallet" && a.chain_type === "ethereum" && typeof a.address === "string" ? [a.address] : [];
  });
}
