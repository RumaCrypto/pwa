import { describe, expect, it } from "vitest";
import { activeIntent, intentActivity, mergeIntentActivity, remoteActivity, reviveActivity } from "./history";
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
      id: "withdrawal:0xaurora",
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

const WALLET = "0xB619Bbef3D9ac0B4751c6f1483F4aA4Ef70480dc";
const USDC_BASE = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const USDT_TRON = "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near";
const TOKENS = [
  { assetId: USDC_BASE, blockchain: "base", symbol: "USDC", decimals: 6, price: 1, contractAddress: null },
  { assetId: USDT_TRON, blockchain: "tron", symbol: "USDT", decimals: 6, price: 1, contractAddress: null },
];
// Trimmed from Aurora's real answer for the 3.6 USDC → Tron withdrawal.
const AURORA_WITHDRAWAL = {
  originAsset: USDC_BASE,
  destinationAsset: USDT_TRON,
  depositAddress: "0x73a0F69Ab27579E83c772333CEe0dB41c62c2Ec6",
  recipient: "TYMy48f1yCW48GQWGayXaZjL2UT5wes8xL",
  status: "SUCCESS",
  createdAt: "2026-10-08T00:48:49.623Z",
  amountInFormatted: "3.6",
  amountOutFormatted: "1.867927",
  refundTo: WALLET,
  senders: [WALLET],
};

describe("remoteActivity", () => {
  it("reads a withdrawal from Aurora's history, with no link since this device may not know it", () => {
    expect(remoteActivity([AURORA_WITHDRAWAL], TOKENS, [WALLET])).toEqual([
      {
        id: "withdrawal:0x73a0f69ab27579e83c772333cee0db41c62c2ec6",
        kind: "withdrawal",
        network: "tron",
        usdc: "3.6",
        other: "1.867927 USDT",
        status: "delivered",
        occurredAt: new Date("2026-10-08T00:48:49.623Z"),
        href: null,
      },
    ]);
  });

  it("reads a deposit that arrived in one of the user's wallets", () => {
    const deposit = {
      ...AURORA_WITHDRAWAL,
      originAsset: USDT_TRON,
      destinationAsset: USDC_BASE,
      depositAddress: "TDepositAddr",
      recipient: WALLET.toLowerCase(),
      refundTo: "TRefund",
      amountInFormatted: "10",
      amountOutFormatted: "9.99",
      status: "PROCESSING",
    };
    expect(remoteActivity([deposit], TOKENS, [WALLET])).toMatchObject([
      { id: "deposit:tdepositaddr", kind: "deposit", network: "tron", usdc: "9.99", other: "10 USDT", status: "pending" },
    ]);
  });

  it("skips what moved no money, unknown assets, other people's swaps and malformed entries", () => {
    const rows = remoteActivity(
      [
        { ...AURORA_WITHDRAWAL, status: "PENDING_DEPOSIT" },
        { ...AURORA_WITHDRAWAL, destinationAsset: "nep141:unknown.near" },
        { ...AURORA_WITHDRAWAL, originAsset: USDT_TRON, destinationAsset: USDC_BASE, recipient: "0xsomeoneelse" },
        { ...AURORA_WITHDRAWAL, createdAt: "not a date" },
        null,
        "x",
      ],
      TOKENS,
      [WALLET]
    );
    expect(rows).toEqual([]);
  });

  it("accepts Aurora's { data } envelope as well as a bare list", () => {
    expect(remoteActivity({ data: [AURORA_WITHDRAWAL] }, TOKENS, [WALLET])).toHaveLength(1);
    expect(remoteActivity({ nope: true }, TOKENS, [WALLET])).toEqual([]);
  });
});

describe("mergeIntentActivity", () => {
  const local = intentActivity([], [withdrawal({ depositAddress: "0x73a0F69Ab27579E83c772333CEe0dB41c62c2Ec6", phase: "processing" })]);
  const remote = remoteActivity([AURORA_WITHDRAWAL], TOKENS, [WALLET]);

  it("keeps one row per operation: Aurora's status and amounts, this device's link", () => {
    const [row, ...rest] = mergeIntentActivity(local, remote);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({ status: "delivered", other: "1.867927 USDT", href: "/withdraw/wallet/track/0x73a0F69Ab27579E83c772333CEe0dB41c62c2Ec6" });
  });

  it("shows operations from other devices and ones Aurora doesn't know yet, newest first", () => {
    const fromHere = intentActivity([deposit({ depositAddress: "here", phase: "processing", createdAt: new Date("2026-10-09T00:00:00Z") })], []);
    expect(mergeIntentActivity(fromHere, remote).map((r) => r.id)).toEqual(["deposit:here", remote[0].id]);
  });
});

describe("reviveActivity", () => {
  it("restores dates from the history route's JSON and drops malformed rows", () => {
    const json = JSON.parse(JSON.stringify(remoteActivity([AURORA_WITHDRAWAL], TOKENS, [WALLET])));
    expect(reviveActivity([...json, { id: 1 }])).toEqual(remoteActivity([AURORA_WITHDRAWAL], TOKENS, [WALLET]));
  });
});
