/**
 * Privy only honours `embeddedWallets.createOnLogin` inside its own modal
 * screens. Our onboarding uses the headless hooks (`useLoginWithEmail`,
 * `useLoginWithPasskey`, `useSignupWithPasskey`), which authenticate without
 * ever creating the wallet — so the app has to do it. Pure, so it is testable
 * without the SDK; `EnsureEmbeddedWallet` wires it to Privy.
 */

const EMBEDDED_CLIENT_TYPES = new Set(["privy", "privy-v2"]);

/** Whether a Privy client user's linked accounts include an embedded Ethereum wallet. */
export function hasEmbeddedEthereumWallet(linkedAccounts: readonly unknown[]): boolean {
  return linkedAccounts.some((account) => {
    if (typeof account !== "object" || account === null) return false;
    const a = account as { type?: unknown; chainType?: unknown; walletClientType?: unknown };
    return (
      a.type === "wallet" &&
      a.chainType === "ethereum" &&
      typeof a.walletClientType === "string" &&
      EMBEDDED_CLIENT_TYPES.has(a.walletClientType)
    );
  });
}

export type WalletSession = {
  ready: boolean;
  authenticated: boolean;
  user: { id: string; linkedAccounts: readonly unknown[] } | null;
};

/**
 * Returns a function to call on every session change. It creates the
 * embedded wallet for a signed-in user who lacks one — new sign-ups and
 * accounts already created without a wallet alike — at most once at a time.
 * A failure is reported and retried on the next call.
 */
export function createEmbeddedWalletEnsurer(
  createWallet: () => Promise<unknown>,
  onError: (error: unknown) => void = () => {}
): (session: WalletSession) => Promise<void> {
  let creatingFor: string | null = null;

  return async ({ ready, authenticated, user }) => {
    if (!ready || !authenticated || !user) return;
    if (hasEmbeddedEthereumWallet(user.linkedAccounts)) return;
    if (creatingFor === user.id) return;

    creatingFor = user.id;
    try {
      await createWallet();
    } catch (error) {
      onError(error);
    } finally {
      creatingFor = null;
    }
  };
}
