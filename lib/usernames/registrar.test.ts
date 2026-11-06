import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";

import { BASE_COIN_TYPE, chainReader, lookupHandle, resolveHandle, type UsernameReader } from "./registrar";

const ALICE = "0x1111111111111111111111111111111111111111" as Address;
const BOB = "0x2222222222222222222222222222222222222222" as Address;

function reader(overrides: Partial<UsernameReader>): UsernameReader {
  return {
    labelOf: async () => "",
    isAvailable: async () => true,
    resolve: async () => null,
    ...overrides,
  };
}

describe("lookupHandle", () => {
  it("returns the label when it resolves back to the same address", async () => {
    const resolve = vi.fn(async () => ALICE);
    const label = await lookupHandle(reader({ labelOf: async () => "alice", resolve }), ALICE);
    expect(label).toBe("alice");
    expect(resolve).toHaveBeenCalledWith("alice.rumalatam.eth");
  });

  it("compares addresses regardless of checksum case", async () => {
    const mixed = "0xAbCdEf0000000000000000000000000000000001" as Address;
    const label = await lookupHandle(
      reader({ labelOf: async () => "alice", resolve: async () => mixed.toLowerCase() as Address }),
      mixed
    );
    expect(label).toBe("alice");
  });

  it("returns null when the address has no name", async () => {
    const resolve = vi.fn();
    expect(await lookupHandle(reader({ resolve }), ALICE)).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("returns null when the name points somewhere else", async () => {
    expect(await lookupHandle(reader({ labelOf: async () => "alice", resolve: async () => BOB }), ALICE)).toBeNull();
  });

  it("returns null when the name no longer resolves", async () => {
    expect(await lookupHandle(reader({ labelOf: async () => "alice", resolve: async () => null }), ALICE)).toBeNull();
  });

  it("lets RPC failures through, so callers keep what they had", async () => {
    const failing = reader({ labelOf: async () => Promise.reject(new Error("rpc down")) });
    await expect(lookupHandle(failing, ALICE)).rejects.toThrow("rpc down");
  });
});

describe("resolveHandle", () => {
  it("adds the parent name before resolving", async () => {
    const resolve = vi.fn(async () => BOB);
    expect(await resolveHandle(reader({ resolve }), "bob")).toBe(BOB);
    expect(resolve).toHaveBeenCalledWith("bob.rumalatam.eth");
  });
});

describe("chainReader", () => {
  it("asks the Universal Resolver for the Base address record", async () => {
    const getEnsAddress = vi.fn(async () => ALICE);
    const client = { readContract: vi.fn(), getEnsAddress };
    await chainReader(client, BOB).resolve("alice.rumalatam.eth");
    expect(getEnsAddress).toHaveBeenCalledWith({ name: "alice.rumalatam.eth", coinType: BASE_COIN_TYPE });
  });

  it("reads labelOf and isAvailable from the registrar", async () => {
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === "labelOf" ? "alice" : false
    );
    const r = chainReader({ readContract, getEnsAddress: vi.fn() }, BOB);
    expect(await r.labelOf(ALICE)).toBe("alice");
    expect(await r.isAvailable("alice")).toBe(false);
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: BOB, functionName: "labelOf", args: [ALICE] }));
  });
});
