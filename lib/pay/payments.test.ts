import { describe, expect, it } from "vitest";
import { PAY_FEE_RATE, buildPayment, payStageAt, payProgressAt, stepStateAt, PAY_STEPS } from "./payments";
import { fromNumber } from "@/lib/money/money";

const START = new Date("2026-09-12T19:47:00Z");
const after = (seconds: number) => new Date(START.getTime() + seconds * 1000);

describe("buildPayment", () => {
  it("reproduces the QR screens from the designs", () => {
    const payment = buildPayment(fromNumber(20, "USD"), START);

    expect(payment.amount).toEqual(fromNumber(20, "USD"));
    expect(payment.fee).toEqual(fromNumber(0.2, "USD"));
    expect(payment.total).toEqual(fromNumber(20.2, "USD"));
  });

  it("charges one percent", () => {
    expect(PAY_FEE_RATE).toBeCloseTo(0.01, 10);
    expect(buildPayment(fromNumber(55, "USD"), START).fee).toEqual(fromNumber(0.55, "USD"));
  });

  it("rounds the fee to whole cents", () => {
    expect(buildPayment(fromNumber(3.33, "USD"), START).fee).toEqual(fromNumber(0.03, "USD"));
  });

  it("mints a receipt hash up front so the success screen has one to show", () => {
    expect(buildPayment(fromNumber(20, "USD"), START).receipt).toMatch(/^0x[0-9a-f]{40}$/);
  });
});

describe("payStageAt", () => {
  const payment = buildPayment(fromNumber(20, "USD"), START);

  it("waits on the scan no matter how much time passes", () => {
    expect(payStageAt(payment, START)).toBe("assigned");
    expect(payStageAt(payment, after(600))).toBe("assigned");
  });

  it("moves to shared once the QR is scanned", () => {
    const scanned = { ...payment, scannedAt: after(30) };
    expect(payStageAt(scanned, after(31))).toBe("shared");
  });

  it("settles a while after the scan, not after creation", () => {
    const scanned = { ...payment, scannedAt: after(300) };
    expect(payStageAt(scanned, after(305))).toBe("shared");
    expect(payStageAt(scanned, after(330))).toBe("settled");
  });
});

describe("stepStateAt", () => {
  const payment = buildPayment(fromNumber(20, "USD"), START);

  it("shows the payer already assigned and the scan waiting on the user", () => {
    expect(PAY_STEPS.map((step) => stepStateAt(step, payment, START))).toEqual([
      "done",
      "current",
      "pending",
    ]);
  });

  it("moves to the business charging once the QR is shared", () => {
    const scanned = { ...payment, scannedAt: START };
    expect(PAY_STEPS.map((step) => stepStateAt(step, scanned, after(5)))).toEqual([
      "done",
      "done",
      "current",
    ]);
  });

  it("marks everything done once settled", () => {
    const scanned = { ...payment, scannedAt: START };
    expect(PAY_STEPS.map((step) => stepStateAt(step, scanned, after(60)))).toEqual([
      "done",
      "done",
      "done",
    ]);
  });
});

describe("payProgressAt", () => {
  it("stays partial until scanned and reaches full once settled", () => {
    const payment = buildPayment(fromNumber(20, "USD"), START);
    expect(payProgressAt(payment, after(600))).toBeLessThan(1);

    const scanned = { ...payment, scannedAt: START };
    expect(payProgressAt(scanned, after(60))).toBe(1);
  });
});
