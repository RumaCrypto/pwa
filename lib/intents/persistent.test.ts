import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { USDC_BASE_ASSET_ID, depositSymbols, type IntentsToken } from "./networks";
import {
  buildDepositHistory,
  buildPersistentAddressRequest,
  formatTransfer,
  isBelowMinimum,
  parsePersistentAddress,
  parsePersistentHistory,
  parsePersistentTransfers,
  persistentTerms,
  usesPersistentAddress,
  validatePersistentAddressBody,
  type PersistentTransfer,
} from "./persistent";

const USER = "0x5aeda56215b167893e80b4fe645ba6d5bab767de";
const TRON_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_TRON = "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near";

const TRX = "nep141:tron.omft.near";

const TOKENS = [
  { assetId: TRX, decimals: 6, blockchain: "tron", symbol: "TRX", price: 0.3, contractAddress: null },
  { assetId: USDT_TRON, decimals: 6, blockchain: "tron", symbol: "USDT", price: 1, contractAddress: null },
  { assetId: USDC_BASE_ASSET_ID, decimals: 6, blockchain: "base", symbol: "USDC", price: 1, contractAddress: null },
] satisfies IntentsToken[];

const transfer = (txHash: string, at: string, amount = "1000000", assetId: string | null = USDT_TRON): PersistentTransfer => ({
  txHash,
  assetId,
  decimals: 6,
  amount,
  createdAt: new Date(at),
});

describe("usesPersistentAddress", () => {
  it("is Tron only; every other network keeps one-time quotes", () => {
    expect(usesPersistentAddress("tron")).toBe(true);
    for (const network of ["eth", "arb", "op", "btc", "near"] as const) expect(usesPersistentAddress(network)).toBe(false);
  });
});

describe("validatePersistentAddressBody", () => {
  it("accepts Tron with an EVM recipient, checksummed so the address identity never depends on letter case", () => {
    expect(validatePersistentAddressBody({ network: "tron", recipient: USER })).toEqual({
      network: "tron",
      recipient: getAddress(USER),
    });
  });

  it("refuses networks that use one-time quotes, unknown networks and bad recipients", () => {
    expect(validatePersistentAddressBody({ network: "eth", recipient: USER })).toBeNull();
    expect(validatePersistentAddressBody({ network: "base", recipient: USER })).toBeNull();
    expect(validatePersistentAddressBody({ network: "tron", recipient: TRON_ADDRESS })).toBeNull();
    expect(validatePersistentAddressBody({ network: "tron" })).toBeNull();
    expect(validatePersistentAddressBody(null)).toBeNull();
  });
});

describe("buildPersistentAddressRequest", () => {
  const body = { network: "tron" as const, recipient: getAddress(USER) };

  it("sends USDC on Base by asset ID to the user's wallet, owned by the session's user", () => {
    expect(buildPersistentAddressRequest(body, "did:privy:abc")).toEqual({
      recipient: getAddress(USER),
      sender: "did:privy:abc",
      depositChain: "tron",
      destinationChain: "base",
      destinationAsset: USDC_BASE_ASSET_ID,
      recipientType: "DESTINATION_CHAIN",
      confidential: false,
    });
  });

  it("falls back to the wallet as the sender when auth is off", () => {
    expect(buildPersistentAddressRequest(body, null).sender).toBe(USER);
  });
});

describe("parsePersistentAddress", () => {
  it("returns the address, and a memo only when there is one", () => {
    expect(parsePersistentAddress({ depositAddress: TRON_ADDRESS, alreadyExists: true }, "tron")).toEqual({
      depositAddress: TRON_ADDRESS,
    });
    expect(parsePersistentAddress({ depositAddress: TRON_ADDRESS, memo: "42" }, "tron").memo).toBe("42");
  });

  it("refuses anything that is not an address on the network, since funds sent there would be lost", () => {
    expect(() => parsePersistentAddress({ depositAddress: USER }, "tron")).toThrow();
    expect(() => parsePersistentAddress({}, "tron")).toThrow();
    expect(() => parsePersistentAddress(null, "tron")).toThrow();
  });
});

describe("parsePersistentTransfers", () => {
  it("reads Aurora's unified shape and drops malformed entries", () => {
    const result = parsePersistentTransfers({
      deposits: [
        { tx_hash: "0xa", asset_id: USDT_TRON, decimals: 6, amount: "25000000", created_at: "2026-11-16T10:00:00Z" },
        { tx_hash: "0xb", asset_id: null, decimals: null, amount: "1", created_at: "not a date" },
        { amount: "1" },
      ],
    });
    expect(result).toEqual({
      transfers: [{ txHash: "0xa", assetId: USDT_TRON, decimals: 6, amount: "25000000", createdAt: new Date("2026-11-16T10:00:00Z") }],
      incomplete: false,
    });
  });

  it("passes on Aurora's incomplete flag, since an empty list then means unknown", () => {
    expect(parsePersistentTransfers({ deposits: [], incomplete: true }).incomplete).toBe(true);
  });

  it("fails without a list", () => {
    expect(() => parsePersistentTransfers({})).toThrow();
  });
});

describe("parsePersistentHistory", () => {
  it("parses each of our route's lists", () => {
    const raw = { tx_hash: "0xa", asset_id: USDT_TRON, decimals: 6, amount: "1", created_at: "2026-11-16T10:00:00Z" };
    const history = parsePersistentHistory({ received: [raw], success: [], failed: [], incomplete: true });
    expect(history.received).toHaveLength(1);
    expect(history.success).toEqual([]);
    expect(history.incomplete).toBe(true);
  });

  it("fails when a list is missing", () => {
    expect(() => parsePersistentHistory({ received: [] })).toThrow();
  });
});

describe("buildDepositHistory", () => {
  it("lists a deposit without a payout as converting", () => {
    const deposit = transfer("in1", "2026-11-16T10:00:00Z");
    expect(buildDepositHistory({ received: [deposit], success: [], failed: [] })).toEqual([{ deposit, status: "converting" }]);
  });

  it("pairs deposits with payouts first-in, first-out, and lists the newest first", () => {
    const first = transfer("in1", "2026-11-16T10:00:00Z");
    const second = transfer("in2", "2026-11-16T11:00:00Z");
    const firstPayout = transfer("out1", "2026-11-16T10:02:00Z", "990000", USDC_BASE_ASSET_ID);
    const history = buildDepositHistory({ received: [second, first], success: [firstPayout], failed: [] });
    expect(history).toEqual([
      { deposit: second, status: "converting" },
      { deposit: first, status: "completed", payout: firstPayout },
    ]);
  });

  it("marks a deposit failed when its payout failed", () => {
    const deposit = transfer("in1", "2026-11-16T10:00:00Z");
    const failed = transfer("out1", "2026-11-16T10:03:00Z", "990000", USDC_BASE_ASSET_ID);
    expect(buildDepositHistory({ received: [deposit], success: [], failed: [failed] })).toEqual([
      { deposit, status: "failed", payout: failed },
    ]);
  });

  it("tolerates a payout logged slightly before its deposit, but skips one from long before", () => {
    const deposit = transfer("in1", "2026-11-16T10:00:00Z");
    const skewed = transfer("out1", "2026-11-16T09:59:30Z", "990000", USDC_BASE_ASSET_ID);
    expect(buildDepositHistory({ received: [deposit], success: [skewed], failed: [] })[0].status).toBe("completed");

    const earlier = transfer("out0", "2026-11-15T09:00:00Z", "990000", USDC_BASE_ASSET_ID);
    expect(buildDepositHistory({ received: [deposit], success: [earlier], failed: [] })).toEqual([
      { deposit, status: "converting" },
    ]);
  });
});

describe("formatTransfer", () => {
  it("formats the smallest unit with the token's symbol", () => {
    expect(formatTransfer(transfer("a", "2026-11-16T10:00:00Z", "25500000"), TOKENS)).toBe("25.5 USDT");
    expect(formatTransfer(transfer("b", "2026-11-16T10:00:00Z", "24910000", USDC_BASE_ASSET_ID), TOKENS)).toBe("24.91 USDC");
  });

  it("caps the decimals at six and drops trailing zeros", () => {
    const trx = { ...transfer("a", "2026-11-16T10:00:00Z", "1234567891234567891"), decimals: 18 };
    expect(formatTransfer(trx, TOKENS)).toBe("1.234567 USDT");
    expect(formatTransfer(transfer("b", "2026-11-16T10:00:00Z", "3000000"), TOKENS)).toBe("3 USDT");
  });

  it("takes the decimals from the token list when Aurora sends none, and shows unknown assets without a symbol", () => {
    expect(formatTransfer({ ...transfer("a", "2026-11-16T10:00:00Z", "2000000"), decimals: null }, TOKENS)).toBe("2 USDT");
    expect(formatTransfer(transfer("b", "2026-11-16T10:00:00Z", "2000000", "nep141:unknown"), TOKENS)).toBe("2");
  });
});

describe("depositSymbols", () => {
  it("lists what the Tron screen asks for", () => {
    expect(depositSymbols("tron")).toEqual(["USDT", "TRX"]);
    expect(depositSymbols("near")).toEqual(["USDC", "USDT", "NEAR"]);
  });
});

describe("persistentTerms", () => {
  it("states Tron's minimums and fee, and nothing for networks without a permanent address", () => {
    expect(persistentTerms("tron")).toEqual({
      minimums: [
        { symbol: "USDT", amount: "3" },
        { symbol: "TRX", amount: "10" },
      ],
      feeUsd: "1.50",
    });
    expect(persistentTerms("eth")).toBeNull();
  });
});

describe("isBelowMinimum", () => {
  const terms = persistentTerms("tron");
  const at = "2026-11-17T10:00:00Z";

  it("compares against the minimum of the deposit's own asset", () => {
    expect(isBelowMinimum(transfer("a", at, "2999999"), TOKENS, terms)).toBe(true);
    expect(isBelowMinimum(transfer("b", at, "3000000"), TOKENS, terms)).toBe(false);
    expect(isBelowMinimum(transfer("c", at, "9000000", TRX), TOKENS, terms)).toBe(true);
    expect(isBelowMinimum(transfer("d", at, "10000000", TRX), TOKENS, terms)).toBe(false);
  });

  it("says no when it can't tell, rather than calling a deposit stuck", () => {
    expect(isBelowMinimum(transfer("a", at, "1", "nep141:unknown"), TOKENS, terms)).toBe(false);
    expect(isBelowMinimum(transfer("b", at, "1"), [], terms)).toBe(false);
    expect(isBelowMinimum(transfer("c", at, "1"), TOKENS, null)).toBe(false);
  });
});

describe("buildDepositHistory with a minimum", () => {
  it("keeps a too-small deposit out of the pairing, so the next deposit gets its own payout", () => {
    const small = transfer("in1", "2026-11-17T10:00:00Z", "2000000");
    const big = transfer("in2", "2026-11-17T10:05:00Z", "25000000");
    const payout = transfer("out1", "2026-11-17T10:07:00Z", "23500000", USDC_BASE_ASSET_ID);
    const below = (t: PersistentTransfer) => isBelowMinimum(t, TOKENS, persistentTerms("tron"));
    expect(buildDepositHistory({ received: [small, big], success: [payout], failed: [] }, below)).toEqual([
      { deposit: big, status: "completed", payout },
      { deposit: small, status: "belowMinimum" },
    ]);
  });
});
