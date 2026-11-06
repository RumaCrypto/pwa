import { describe, expect, it, vi } from "vitest";
import { zeroAddress, type Address } from "viem";

import { UsernameLookupError, UsernameNotFoundError, parseRumaRecipient, resolveRumaRecipient } from "./recipient";

const BOB = "0x2222222222222222222222222222222222222222" as Address;

describe("parseRumaRecipient", () => {
  it("takes a wallet address as is", () => {
    expect(parseRumaRecipient(` ${BOB} `)).toEqual({ kind: "address", address: BOB });
  });

  it("flags something that looks like an address but isn't one", () => {
    expect(parseRumaRecipient("0x123")).toEqual({ kind: "invalidAddress" });
  });

  it("reads a username however it's written", () => {
    for (const input of ["bob123", "@bob123", "Bob123.rumalatam.eth"]) {
      expect(parseRumaRecipient(input)).toEqual({ kind: "handle", label: "bob123" });
    }
  });

  it("knows a malformed username can't belong to anyone, without asking the chain", () => {
    expect(parseRumaRecipient("bo")).toEqual({ kind: "notFound", label: "bo" });
    expect(parseRumaRecipient("josé")).toEqual({ kind: "notFound", label: "josé" });
    expect(parseRumaRecipient("vitalik.eth")).toEqual({ kind: "notFound", label: "vitalik.eth" });
  });

  it("still looks up reserved names, which Ruma itself may hold", () => {
    expect(parseRumaRecipient("soporte")).toEqual({ kind: "handle", label: "soporte" });
  });
});

describe("resolveRumaRecipient", () => {
  it("returns the address the username points to", async () => {
    const resolve = vi.fn(async () => BOB);
    expect(await resolveRumaRecipient({ resolve }, "bob123")).toBe(BOB);
    expect(resolve).toHaveBeenCalledWith("bob123.rumalatam.eth");
  });

  it("reports an unknown username as not found", async () => {
    await expect(resolveRumaRecipient({ resolve: async () => null }, "nobody")).rejects.toBeInstanceOf(UsernameNotFoundError);
    await expect(resolveRumaRecipient({ resolve: async () => zeroAddress }, "nobody")).rejects.toBeInstanceOf(UsernameNotFoundError);
  });

  it("keeps an RPC failure apart from a missing username", async () => {
    const failing = { resolve: async () => Promise.reject(new Error("rpc down")) };
    await expect(resolveRumaRecipient(failing, "bob123")).rejects.toBeInstanceOf(UsernameLookupError);
  });
});
