import { describe, expect, it } from "vitest";
import { activeIntent, intentActivity } from "./history";
import type { IntentDeposit } from "./deposits";
import type { IntentWithdrawal } from "./withdrawals";

const NOW = new Date("2026-10-08T12:00:00Z");
const HOUR = 3_600_000;
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * HOUR);

const deposit = (over: Partial<IntentDeposit> = {}): IntentDeposit => ({
  depositAddress: "TDep",
  network: "tron",
  assetSymbol: "USDT",
  amountInFormatted: "10",
  amountOutFormatted: "9.99",
  createdAt: at(2),
  deadline: new Date(NOW.getTime() + HOUR),
  phase: "completed",
  ...over,
});

const withdrawal = (over: Partial<IntentWithdrawal> = {}): IntentWithdrawal => ({
  depositAddress: "0xAurora",
  network: "tron",
  assetSymbol: "USDT",
  recipient: "TRecipient",
  amountInFormatted: "3.6",
  amountOutFormatted: "1.86",
  minAmountOutFormatted: "1.84",
  createdAt: at(1),
  deadline: new Date(NOW.getTime() + HOUR),
  phase: "completed",
  ...over,
});

describe("intentActivity", () => {
  it("shows a finished withdrawal as USDC that left, with what arrived on the other network", () => {
    const [row] = intentActivity([], [withdrawal({ receivedFormatted: "1.95", completedAt: at(0.5) })]);
    expect(row).toEqual({
      id: "withdrawal:0xAurora",
      kind: "withdrawal",
      network: "tron",
      usdc: "3.6",
      other: "1.95 USDT",
      status: "delivered",
      occurredAt: at(0.5),
      href: "/withdraw/wallet/track/0xAurora",
    });
  });

  it("shows a finished deposit as USDC that arrived, from what was sent", () => {
    const [row] = intentActivity([deposit({ receivedFormatted: "9.98" })], []);
    expect(row).toMatchObject({ kind: "deposit", usdc: "9.98", other: "10 USDT", status: "delivered", href: "/add-money/wallet/deposit/TDep" });
  });

  it("marks converting ones pending and refunded or failed ones failed", () => {
    const rows = intentActivity(
      [deposit({ depositAddress: "a", phase: "processing" }), deposit({ depositAddress: "b", phase: "refunded" })],
      [withdrawal({ depositAddress: "c", phase: "awaiting_transfer" }), withdrawal({ depositAddress: "d", phase: "failed" })]
    );
    expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({
      "deposit:a": "pending",
      "deposit:b": "failed",
      "withdrawal:c": "pending",
      "withdrawal:d": "failed",
    });
  });

  it("leaves out what never moved money: unfunded deposit addresses and transfers that were never sent", () => {
    const rows = intentActivity([deposit({ phase: "awaiting_deposit" })], [withdrawal({ phase: "transfer_failed" })]);
    expect(rows).toEqual([]);
  });

  it("lists the newest first", () => {
    const rows = intentActivity([deposit({ createdAt: at(5) })], [withdrawal({ createdAt: at(1), completedAt: undefined })]);
    expect(rows.map((r) => r.kind)).toEqual(["withdrawal", "deposit"]);
  });
});

describe("activeIntent", () => {
  it("is the newest operation still in flight, including an address waiting for the user's transfer", () => {
    const active = activeIntent(
      [deposit({ depositAddress: "waiting", phase: "awaiting_deposit", createdAt: at(0.2) })],
      [withdrawal({ phase: "processing", createdAt: at(1) })],
      NOW
    );
    expect(active).toMatchObject({ id: "deposit:waiting", kind: "deposit", status: "pending" });
  });

  it("ignores expired deposit addresses and anything long past its deadline", () => {
    const active = activeIntent(
      [deposit({ phase: "awaiting_deposit", deadline: at(1) })],
      [withdrawal({ phase: "processing", deadline: at(30) })],
      NOW
    );
    expect(active).toBeNull();
  });

  it("is null when everything has settled", () => {
    expect(activeIntent([deposit()], [withdrawal()], NOW)).toBeNull();
  });
});
