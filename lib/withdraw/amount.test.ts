import { describe, expect, it } from "vitest";
import { balanceToMoney, fitsBalance, maxSend, shareOfMax, toDraft } from "./amount";
import { feeOn } from "@/lib/send/quote";
import { add, fromNumber } from "@/lib/money/money";

const usd = (n: number) => fromNumber(n, "USD");

describe("balanceToMoney", () => {
  it("truncates USDC's six decimals to cents, never rounding up past what's there", () => {
    expect(balanceToMoney("9.995")).toEqual(usd(9.99));
    expect(balanceToMoney("6.4")).toEqual(usd(6.4));
    expect(balanceToMoney("0.009999")).toEqual(usd(0));
  });
});

describe("fitsBalance", () => {
  it("counts the fee: the send plus its 0.6% must fit", () => {
    expect(fitsBalance(usd(100), usd(100.6))).toBe(true);
    expect(fitsBalance(usd(100), usd(100.59))).toBe(false);
  });
});

describe("maxSend", () => {
  it("is the largest send whose total still fits the balance", () => {
    for (const balance of [usd(10), usd(6.4), usd(100.6), usd(1234.56), usd(0.01)]) {
      const max = maxSend(balance);
      expect(add(max, feeOn(max)).amount <= balance.amount).toBe(true);
      const oneCentMore = { ...max, amount: max.amount + 1n };
      expect(add(oneCentMore, feeOn(oneCentMore)).amount > balance.amount).toBe(true);
    }
  });

  it("is zero with an empty balance", () => {
    expect(maxSend(usd(0))).toEqual(usd(0));
  });

  it("never goes past the sell limit when one is given", () => {
    expect(maxSend(usd(1006), usd(300))).toEqual(usd(300));
    // Below the limit, the balance is what binds.
    expect(maxSend(usd(100.6), usd(300))).toEqual(usd(100));
    expect(maxSend(usd(100.6), usd(0))).toEqual(usd(0));
  });
});

describe("shareOfMax", () => {
  it("takes a share of the max and rounds down, so it always fits", () => {
    const balance = usd(100.6); // max is exactly 100.00
    expect(shareOfMax(balance, 25)).toEqual(usd(25));
    expect(shareOfMax(balance, 50)).toEqual(usd(50));
    expect(shareOfMax(balance, 100)).toEqual(usd(100));
    expect(shareOfMax(usd(0.05), 25)).toEqual(usd(0.01));
  });

  it("takes the share of the limit when the limit is below the balance", () => {
    expect(shareOfMax(usd(1006), 25, usd(300))).toEqual(usd(75));
    expect(shareOfMax(usd(1006), 100, usd(300))).toEqual(usd(300));
  });
});

describe("toDraft", () => {
  it("writes the keypad's draft: no trailing zeros, '.' as separator", () => {
    expect(toDraft(usd(25))).toBe("25");
    expect(toDraft(usd(12.5))).toBe("12.5");
    expect(toDraft(usd(0.07))).toBe("0.07");
    expect(toDraft(usd(1234.56))).toBe("1234.56");
  });
});
