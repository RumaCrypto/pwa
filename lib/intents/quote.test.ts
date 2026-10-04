import { describe, expect, it } from "vitest";
import {
  DEPOSIT_SLIPPAGE_BPS,
  buildQuoteRequest,
  parseAmount,
  parseQuoteResponse,
  refundModeFrom,
  validateQuoteRequest,
} from "./quote";
import { USDC_BASE_ASSET_ID, type DepositAsset } from "./networks";

const USDT_TRON: DepositAsset = {
  assetId: "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
  symbol: "USDT",
  decimals: 6,
  priceUsd: 1,
};
const USER = "0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE" as const;
const NOW = new Date("2026-10-04T12:00:00Z");

describe("parseAmount", () => {
  it("converts a decimal string to the asset's smallest unit", () => {
    expect(parseAmount("25.5", 6)).toBe(25_500_000n);
  });

  it("accepts a comma as the decimal separator, as es/pt keyboards type it", () => {
    expect(parseAmount("25,5", 6)).toBe(25_500_000n);
  });

  it("rejects zero, garbage and more decimals than the asset has", () => {
    expect(parseAmount("0", 6)).toBeNull();
    expect(parseAmount("", 6)).toBeNull();
    expect(parseAmount("abc", 6)).toBeNull();
    expect(parseAmount("1.0000001", 6)).toBeNull();
  });
});

const TRON_REFUND = { type: "ORIGIN_CHAIN", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" } as const;

describe("refundModeFrom", () => {
  it("refunds to the origin chain unless intents is asked for explicitly", () => {
    expect(refundModeFrom(undefined)).toBe("origin");
    expect(refundModeFrom("")).toBe("origin");
    expect(refundModeFrom("whatever")).toBe("origin");
    expect(refundModeFrom("intents")).toBe("intents");
  });
});

describe("buildQuoteRequest", () => {
  const request = buildQuoteRequest({ asset: USDT_TRON, amount: 25_000_000n, recipient: USER, refund: TRON_REFUND, now: NOW });

  it("asks for a live one-time address on the origin chain that settles as USDC on Base", () => {
    expect(request).toMatchObject({
      dry: false,
      swapType: "FLEX_INPUT",
      depositType: "ORIGIN_CHAIN",
      originAsset: USDT_TRON.assetId,
      destinationAsset: USDC_BASE_ASSET_ID,
      amount: "25000000",
      recipient: USER,
      recipientType: "DESTINATION_CHAIN",
      slippageTolerance: DEPOSIT_SLIPPAGE_BPS,
    });
  });

  it("refunds to the address the user gave on the origin chain", () => {
    expect(request.refundType).toBe("ORIGIN_CHAIN");
    expect(request.refundTo).toBe(TRON_REFUND.address);
  });

  it("refunds into the user's own Intents account in intents mode", () => {
    const intents = buildQuoteRequest({ asset: USDT_TRON, amount: 1n, recipient: USER, refund: { type: "INTENTS" }, now: NOW });
    expect(intents.refundType).toBe("INTENTS");
    expect(intents.refundTo).toBe(USER.toLowerCase());
  });

  it("keeps the address open for an hour", () => {
    expect(request.deadline).toBe("2026-10-04T13:00:00.000Z");
  });
});

describe("validateQuoteRequest", () => {
  const valid = buildQuoteRequest({ asset: USDT_TRON, amount: 1n, recipient: USER, refund: TRON_REFUND, now: NOW });
  const intents = buildQuoteRequest({ asset: USDT_TRON, amount: 1n, recipient: USER, refund: { type: "INTENTS" }, now: NOW });

  it("passes a request the app itself built", () => {
    expect(validateQuoteRequest(valid, "origin")).toEqual(valid);
    expect(validateQuoteRequest(intents, "intents")).toEqual(intents);
  });

  it("only accepts the refund mode the server is configured for", () => {
    expect(validateQuoteRequest(intents, "origin")).toBeNull();
    expect(validateQuoteRequest(valid, "intents")).toBeNull();
    expect(validateQuoteRequest({ ...valid, refundTo: "" }, "origin")).toBeNull();
    expect(validateQuoteRequest({ ...intents, refundTo: "someone.near" }, "intents")).toBeNull();
  });

  it("refuses anything that would not land as USDC on Base", () => {
    expect(validateQuoteRequest({ ...valid, destinationAsset: "nep141:wrap.near" }, "origin")).toBeNull();
    expect(validateQuoteRequest({ ...valid, recipientType: "INTENTS" }, "origin")).toBeNull();
    expect(validateQuoteRequest({ ...valid, recipient: "alice.near" }, "origin")).toBeNull();
    expect(validateQuoteRequest({ ...valid, amount: "-1" }, "origin")).toBeNull();
    expect(validateQuoteRequest({ ...valid, amount: "0" }, "origin")).toBeNull();
    expect(validateQuoteRequest(null, "origin")).toBeNull();
  });

  it("strips unknown fields and returns only the 12 QuoteRequest fields", () => {
    const withExtra = { ...valid, appFees: "100", referral: "alice.near" };
    const result = validateQuoteRequest(withExtra, "origin");
    expect(result).not.toBeNull();
    expect(result).toEqual(valid);
    expect(result).not.toHaveProperty("appFees");
    expect(result).not.toHaveProperty("referral");
  });
});

describe("parseQuoteResponse", () => {
  const body = {
    timestamp: "2026-10-04T12:00:00Z",
    signature: "sig",
    quoteRequest: {},
    quote: {
      depositAddress: "TXyz",
      amountIn: "25000000",
      amountInFormatted: "25",
      amountInUsd: "25",
      minAmountIn: "24750000",
      amountOut: "24900000",
      amountOutFormatted: "24.9",
      amountOutUsd: "24.9",
      minAmountOut: "24651000",
      deadline: "2026-10-04T13:00:00.000Z",
      timeEstimate: 120,
    },
  };

  it("keeps what the deposit screen needs", () => {
    expect(parseQuoteResponse(body)).toEqual({
      depositAddress: "TXyz",
      depositMemo: undefined,
      amountInFormatted: "25",
      minAmountIn: "24750000",
      amountOutFormatted: "24.9",
      minAmountOut: "24651000",
      deadline: "2026-10-04T13:00:00.000Z",
      timeEstimate: 120,
    });
  });

  it("fails loudly when Aurora returns no address, rather than showing an empty one", () => {
    expect(() => parseQuoteResponse({ ...body, quote: { ...body.quote, depositAddress: undefined } })).toThrow(
      /deposit address/
    );
  });
});
