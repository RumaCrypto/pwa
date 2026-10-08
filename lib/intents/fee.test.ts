import { describe, expect, it, vi } from "vitest";
import { maxWithdrawable, readWithdrawFee } from "./fee";

const TREASURY = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

describe("readWithdrawFee", () => {
  it("is off unless explicitly enabled", () => {
    expect(readWithdrawFee({})).toEqual({ enabled: false, amount: 0n, treasury: null });
    expect(readWithdrawFee({ enabled: "1", treasury: TREASURY })).toEqual({ enabled: false, amount: 0n, treasury: null });
  });

  it("charges 0.10 USDC by default once enabled with a treasury", () => {
    expect(readWithdrawFee({ enabled: "true", treasury: TREASURY })).toEqual({ enabled: true, amount: 100_000n, treasury: TREASURY });
  });

  it("reads the amount", () => {
    expect(readWithdrawFee({ enabled: "true", amountUsd: "0.25", treasury: TREASURY }).amount).toBe(250_000n);
  });

  it("stays off, and says so, without a valid treasury or with an amount out of range", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readWithdrawFee({ enabled: "true" }).enabled).toBe(false);
    expect(readWithdrawFee({ enabled: "true", treasury: "nope" }).enabled).toBe(false);
    expect(readWithdrawFee({ enabled: "true", amountUsd: "0", treasury: TREASURY }).enabled).toBe(false);
    expect(readWithdrawFee({ enabled: "true", amountUsd: "5.01", treasury: TREASURY }).enabled).toBe(false);
    expect(readWithdrawFee({ enabled: "true", amountUsd: "abc", treasury: TREASURY }).enabled).toBe(false);
    expect(warn).toHaveBeenCalledTimes(5);
    warn.mockRestore();
  });
});

describe("maxWithdrawable", () => {
  const on = readWithdrawFee({ enabled: "true", treasury: TREASURY });
  const off = readWithdrawFee({});

  it("is the whole balance without a fee, and the balance minus the fee with one", () => {
    expect(maxWithdrawable(10_000_000n, off)).toBe(10_000_000n);
    expect(maxWithdrawable(10_000_000n, on)).toBe(9_900_000n);
  });

  it("is never negative", () => {
    expect(maxWithdrawable(50_000n, on)).toBe(0n);
  });
});
