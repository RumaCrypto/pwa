import { describe, expect, it } from "vitest";
import { ethereumWallets, ownsWallet } from "./wallets";

const accounts = [
  { type: "email", address: "a@b.c" },
  { type: "wallet", chain_type: "ethereum", address: "0xAAA" },
  { type: "wallet", chain_type: "ethereum", address: "0xBbB" },
  { type: "wallet", chain_type: "solana", address: "SoL111" },
];

describe("ownsWallet", () => {
  it("matches any linked Ethereum wallet, not just the first", () => {
    expect(ownsWallet(accounts, "0xbbb")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(ownsWallet(accounts, "0xaaa")).toBe(true);
    expect(ownsWallet(accounts, "0XAAA")).toBe(true);
  });
  it("ignores Solana and non-wallet accounts", () => {
    expect(ownsWallet(accounts, "SoL111")).toBe(false);
    expect(ownsWallet(accounts, "a@b.c")).toBe(false);
  });
  it("is false when nothing matches", () => {
    expect(ownsWallet(accounts, "0xccc")).toBe(false);
    expect(ownsWallet([], "0xaaa")).toBe(false);
    expect(ownsWallet([null, "x"], "0xaaa")).toBe(false);
  });
});

describe("ethereumWallets", () => {
  it("lists every linked Ethereum wallet and nothing else", () => {
    expect(
      ethereumWallets([
        { type: "email", address: "a@b.c" },
        { type: "wallet", chain_type: "solana", address: "Sol111" },
        { type: "wallet", chain_type: "ethereum", address: "0xAAA" },
        null,
        { type: "wallet", chain_type: "ethereum", address: "0xBBB" },
      ])
    ).toEqual(["0xAAA", "0xBBB"]);
  });
});
