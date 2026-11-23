import { describe, expect, it, vi } from "vitest";
import {
  createEmbeddedWalletEnsurer,
  hasEmbeddedEthereumWallet,
  type WalletSession,
} from "./ensure-embedded-wallet";

const email = { type: "email", address: "a@b.c" };
const embeddedEth = { type: "wallet", chainType: "ethereum", walletClientType: "privy", address: "0xAAA" };

function session(linkedAccounts: readonly unknown[], overrides: Partial<WalletSession> = {}): WalletSession {
  return { ready: true, authenticated: true, user: { id: "did:privy:1", linkedAccounts }, ...overrides };
}

describe("hasEmbeddedEthereumWallet", () => {
  it("recognizes Privy's embedded Ethereum wallets, both generations", () => {
    expect(hasEmbeddedEthereumWallet([email, embeddedEth])).toBe(true);
    expect(hasEmbeddedEthereumWallet([{ ...embeddedEth, walletClientType: "privy-v2" }])).toBe(true);
  });

  it("does not count wallets the app cannot sign with as the embedded one", () => {
    expect(hasEmbeddedEthereumWallet([])).toBe(false);
    expect(hasEmbeddedEthereumWallet([email])).toBe(false);
    expect(hasEmbeddedEthereumWallet([{ ...embeddedEth, chainType: "solana" }])).toBe(false);
    expect(hasEmbeddedEthereumWallet([{ ...embeddedEth, walletClientType: "metamask" }])).toBe(false);
  });
});

describe("createEmbeddedWalletEnsurer", () => {
  // The regression: headless email/passkey logins never run Privy's
  // `createOnLogin`, so a fresh account came back with no wallet at all.
  it("creates a wallet for an authenticated user who has none", async () => {
    const createWallet = vi.fn().mockResolvedValue({});
    await createEmbeddedWalletEnsurer(createWallet)(session([email]));
    expect(createWallet).toHaveBeenCalledTimes(1);
  });

  it("does nothing until Privy is ready and the user is signed in, or when a wallet exists", async () => {
    const createWallet = vi.fn().mockResolvedValue({});
    const ensure = createEmbeddedWalletEnsurer(createWallet);
    await ensure(session([email], { ready: false }));
    await ensure(session([email], { authenticated: false }));
    await ensure(session([email], { user: null }));
    await ensure(session([email, embeddedEth]));
    expect(createWallet).not.toHaveBeenCalled();
  });

  // React re-runs effects (StrictMode, user object refreshes) while the first
  // creation is still pending; a second call would hit Privy's
  // "user already has an embedded wallet" error.
  it("creates only one wallet while a creation is already in flight", async () => {
    let resolve!: () => void;
    const createWallet = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const ensure = createEmbeddedWalletEnsurer(createWallet);
    const first = ensure(session([email]));
    const second = ensure(session([email]));
    resolve();
    await Promise.all([first, second]);
    expect(createWallet).toHaveBeenCalledTimes(1);
  });

  it("reports a failed creation and retries on the next session change", async () => {
    const error = new Error("network");
    const createWallet = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({});
    const onError = vi.fn();
    const ensure = createEmbeddedWalletEnsurer(createWallet, onError);
    await ensure(session([email]));
    expect(onError).toHaveBeenCalledWith(error);
    await ensure(session([email]));
    expect(createWallet).toHaveBeenCalledTimes(2);
  });
});
