import { describe, expect, it } from "vitest";
import { bech32, bech32m, createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";
import { isNamedNearAccount, isValidNetworkAddress } from "./addresses";

const base58check = createBase58check(sha256);
const bytes = (length: number, fill: number) => new Uint8Array(length).fill(fill);
const withVersion = (version: number, payload: Uint8Array) => Uint8Array.from([version, ...payload]);

/** Changes the last character to another one from the same alphabet, which breaks the checksum. */
function breakChecksum(address: string, alphabet: string): string {
  const last = address.at(-1)!;
  const replacement = alphabet[(alphabet.indexOf(last) + 1) % alphabet.length];
  return address.slice(0, -1) + replacement;
}
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

describe("isValidNetworkAddress on EVM networks", () => {
  it("accepts checksummed and all-lowercase addresses", () => {
    for (const network of ["eth", "arb", "op"] as const) {
      expect(isValidNetworkAddress(network, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe(true);
      expect(isValidNetworkAddress(network, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(true);
    }
  });

  it("rejects mixed case with a wrong EIP-55 checksum, a short address and other networks' formats", () => {
    expect(isValidNetworkAddress("eth", "0x833589FCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe(false);
    expect(isValidNetworkAddress("eth", "0x833589fcd6edb6e08f4c7c32d4f71b54bda0291")).toBe(false);
    expect(isValidNetworkAddress("eth", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
  });

  it("ignores surrounding whitespace from a paste", () => {
    expect(isValidNetworkAddress("arb", "  0x833589fcd6edb6e08f4c7c32d4f71b54bda02913\n")).toBe(true);
  });
});

describe("isValidNetworkAddress on Tron", () => {
  it("accepts a real address and a generated one with version 0x41", () => {
    expect(isValidNetworkAddress("tron", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true);
    expect(isValidNetworkAddress("tron", base58check.encode(withVersion(0x41, bytes(20, 3))))).toBe(true);
  });

  it("rejects a broken checksum and the wrong version byte", () => {
    expect(isValidNetworkAddress("tron", breakChecksum("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", BASE58))).toBe(false);
    expect(isValidNetworkAddress("tron", base58check.encode(withVersion(0x00, bytes(20, 3))))).toBe(false);
  });
});

describe("isValidNetworkAddress on Bitcoin", () => {
  const segwitV0 = bech32.encode("bc", [0, ...bech32.toWords(bytes(20, 7))]);
  const segwitV0Script = bech32.encode("bc", [0, ...bech32.toWords(bytes(32, 7))]);
  const taproot = bech32m.encode("bc", [1, ...bech32m.toWords(bytes(32, 9))]);

  it("accepts legacy, P2SH, segwit v0 and taproot", () => {
    expect(isValidNetworkAddress("btc", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
    expect(isValidNetworkAddress("btc", base58check.encode(withVersion(0x05, bytes(20, 1))))).toBe(true);
    expect(isValidNetworkAddress("btc", segwitV0)).toBe(true);
    expect(isValidNetworkAddress("btc", segwitV0Script)).toBe(true);
    expect(isValidNetworkAddress("btc", taproot)).toBe(true);
    expect(isValidNetworkAddress("btc", taproot.toUpperCase())).toBe(true);
  });

  it("accepts only v0 (20 or 32 bytes) and v1 with a 32-byte program", () => {
    expect(isValidNetworkAddress("btc", bech32m.encode("bc", [1, ...bech32m.toWords(bytes(20, 9))]))).toBe(false);
    expect(isValidNetworkAddress("btc", bech32m.encode("bc", [2, ...bech32m.toWords(bytes(32, 9))]))).toBe(false);
    expect(isValidNetworkAddress("btc", bech32m.encode("bc", [16, ...bech32m.toWords(bytes(32, 9))]))).toBe(false);
    expect(isValidNetworkAddress("btc", bech32.encode("bc", [0, ...bech32.toWords(bytes(25, 7))]))).toBe(false);
  });

  it("rejects broken checksums, the wrong checksum variant, testnet and mixed case", () => {
    expect(isValidNetworkAddress("btc", breakChecksum("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", BASE58))).toBe(false);
    expect(isValidNetworkAddress("btc", breakChecksum(segwitV0, BECH32))).toBe(false);
    // v0 must use bech32 and v1+ bech32m (BIP-350).
    expect(isValidNetworkAddress("btc", bech32m.encode("bc", [0, ...bech32m.toWords(bytes(20, 7))]))).toBe(false);
    expect(isValidNetworkAddress("btc", bech32.encode("bc", [1, ...bech32.toWords(bytes(32, 9))]))).toBe(false);
    expect(isValidNetworkAddress("btc", bech32.encode("tb", [0, ...bech32.toWords(bytes(20, 7))]))).toBe(false);
    expect(isValidNetworkAddress("btc", segwitV0.slice(0, 6) + segwitV0.slice(6).toUpperCase())).toBe(false);
    expect(isValidNetworkAddress("btc", base58check.encode(withVersion(0x6f, bytes(20, 1))))).toBe(false);
  });
});

describe("isValidNetworkAddress on NEAR", () => {
  it("accepts implicit and named accounts", () => {
    expect(isValidNetworkAddress("near", "a".repeat(64))).toBe(true);
    expect(isValidNetworkAddress("near", "alice.near")).toBe(true);
    expect(isValidNetworkAddress("near", "sub.alice-1.near")).toBe(true);
  });

  it("rejects uppercase, too short and malformed ids", () => {
    expect(isValidNetworkAddress("near", "Alice.near")).toBe(false);
    expect(isValidNetworkAddress("near", "a")).toBe(false);
    expect(isValidNetworkAddress("near", "alice..near")).toBe(false);
  });

  it("tells named accounts, which may not exist, from implicit ones", () => {
    expect(isNamedNearAccount("alice.near")).toBe(true);
    expect(isNamedNearAccount("a".repeat(64))).toBe(false);
  });
});
