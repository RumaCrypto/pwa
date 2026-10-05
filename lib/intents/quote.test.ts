import { describe, expect, it } from "vitest";
import {
  DEPOSIT_SLIPPAGE_BPS,
  SIGN_MARGIN_MS,
  WITHDRAW_SLIPPAGE_BPS,
  buildQuoteRequest,
  buildWithdrawQuoteRequest,
  conversionCostUsd,
  isWithdrawalBody,
  parseAmount,
  parseQuoteResponse,
  parseWithdrawEstimate,
  parseWithdrawQuote,
  quoteStillHolds,
  refundModeFrom,
  validateQuoteRequest,
  validateWithdrawQuoteRequest,
} from "./quote";
import { WithdrawError } from "./withdraw-errors";
import { USDC_BASE_ASSET_ID, type DepositAsset, type WithdrawAsset } from "./networks";

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
    expect(validateQuoteRequest(valid, "origin", NOW)).toEqual(valid);
    expect(validateQuoteRequest(intents, "intents", NOW)).toEqual(intents);
  });

  it("only accepts the refund mode the server is configured for", () => {
    expect(validateQuoteRequest(intents, "origin", NOW)).toBeNull();
    expect(validateQuoteRequest(valid, "intents", NOW)).toBeNull();
    expect(validateQuoteRequest({ ...valid, refundTo: "" }, "origin", NOW)).toBeNull();
    expect(validateQuoteRequest({ ...intents, refundTo: "someone.near" }, "intents", NOW)).toBeNull();
  });

  it("refuses anything that would not land as USDC on Base", () => {
    expect(validateQuoteRequest({ ...valid, destinationAsset: "nep141:wrap.near" }, "origin", NOW)).toBeNull();
    expect(validateQuoteRequest({ ...valid, recipientType: "INTENTS" }, "origin", NOW)).toBeNull();
    expect(validateQuoteRequest({ ...valid, recipient: "alice.near" }, "origin", NOW)).toBeNull();
    expect(validateQuoteRequest({ ...valid, amount: "-1" }, "origin", NOW)).toBeNull();
    expect(validateQuoteRequest({ ...valid, amount: "0" }, "origin", NOW)).toBeNull();
    expect(validateQuoteRequest(null, "origin", NOW)).toBeNull();
  });

  it("strips unknown fields and returns only the 12 QuoteRequest fields", () => {
    const withExtra = { ...valid, appFees: "100", referral: "alice.near" };
    const result = validateQuoteRequest(withExtra, "origin", NOW);
    expect(result).not.toBeNull();
    expect(result).toEqual(valid);
    expect(result).not.toHaveProperty("appFees");
    expect(result).not.toHaveProperty("referral");
  });

  it("only accepts a deadline in the future and at most two hours away", () => {
    const at = (ms: number) => ({ ...valid, deadline: new Date(NOW.getTime() + ms).toISOString() });
    expect(validateQuoteRequest(at(-1000), "origin", NOW)).toBeNull();
    expect(validateQuoteRequest(at(0), "origin", NOW)).toBeNull();
    expect(validateQuoteRequest(at(3 * 3600_000), "origin", NOW)).toBeNull();
    expect(validateQuoteRequest(at(3600_000), "origin", NOW)).toEqual(at(3600_000));
    expect(validateQuoteRequest(at(2 * 3600_000), "origin", NOW)).toEqual(at(2 * 3600_000));
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

  it("fails loudly on a deadline that is not a date, rather than showing \"Invalid Date\"", () => {
    expect(() => parseQuoteResponse({ ...body, quote: { ...body.quote, deadline: "soon" } })).toThrow(/deadline/);
    expect(() => parseQuoteResponse({ ...body, quote: { ...body.quote, deadline: undefined } })).toThrow(/deadline/);
  });

  it("fails loudly when an amount is missing, rather than showing \"undefined\"", () => {
    for (const field of ["amountInFormatted", "amountOutFormatted", "minAmountIn", "minAmountOut"]) {
      expect(() => parseQuoteResponse({ ...body, quote: { ...body.quote, [field]: undefined } })).toThrow(field);
      expect(() => parseQuoteResponse({ ...body, quote: { ...body.quote, [field]: 25 } })).toThrow(field);
    }
  });

  it("fails loudly when the time estimate is not a number", () => {
    expect(() => parseQuoteResponse({ ...body, quote: { ...body.quote, timeEstimate: "fast" } })).toThrow(/timeEstimate/);
    expect(() => parseQuoteResponse({ ...body, quote: { ...body.quote, timeEstimate: undefined } })).toThrow(/timeEstimate/);
  });
});

const W_USDT_TRON: WithdrawAsset = {
  assetId: "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
  symbol: "USDT",
  decimals: 6,
  priceUsd: 1,
  network: "tron",
  contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
};
const OWNER = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;
const TRON_TO = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const W_NOW = new Date("2026-10-04T12:00:00Z");

const withdrawal = (dry = false) =>
  buildWithdrawQuoteRequest({ asset: W_USDT_TRON, amount: 50_000_000n, recipient: ` ${TRON_TO} `, refundTo: OWNER, dry, now: W_NOW });

describe("buildWithdrawQuoteRequest", () => {
  it("sends exact USDC from Base and refunds to the user's own Base wallet", () => {
    expect(withdrawal()).toEqual({
      dry: false,
      swapType: "EXACT_INPUT",
      slippageTolerance: WITHDRAW_SLIPPAGE_BPS,
      originAsset: USDC_BASE_ASSET_ID,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: W_USDT_TRON.assetId,
      amount: "50000000",
      recipient: TRON_TO,
      recipientType: "DESTINATION_CHAIN",
      refundTo: OWNER,
      refundType: "ORIGIN_CHAIN",
      deadline: "2026-10-04T12:30:00.000Z",
    });
  });

  it("is told apart from a deposit by its origin", () => {
    expect(isWithdrawalBody(withdrawal())).toBe(true);
    expect(isWithdrawalBody({ originAsset: "nep141:btc.omft.near" })).toBe(false);
    expect(isWithdrawalBody(null)).toBe(false);
  });
});

describe("validateWithdrawQuoteRequest", () => {
  const allowed = [W_USDT_TRON];

  it("passes what the app builds, dry or live, and names the asset", () => {
    expect(validateWithdrawQuoteRequest(withdrawal(), allowed, W_NOW)).toEqual({ request: withdrawal(), asset: W_USDT_TRON });
    expect(validateWithdrawQuoteRequest(withdrawal(true), allowed, W_NOW)?.request.dry).toBe(true);
  });

  it("strips unknown fields", () => {
    const result = validateWithdrawQuoteRequest({ ...withdrawal(), appFees: [{ recipient: "x", fee: 9999 }] }, allowed, W_NOW);
    expect(result?.request).not.toHaveProperty("appFees");
  });

  it("refuses anything but USDC on Base as the origin", () => {
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), originAsset: "nep141:eth.omft.near" }, allowed, W_NOW)).toBeNull();
  });

  it("refuses a destination outside the allow-list", () => {
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), destinationAsset: "nep141:eth.omft.near" }, allowed, W_NOW)).toBeNull();
  });

  it("refuses a recipient that is not a valid address on the destination network", () => {
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), recipient: OWNER }, allowed, W_NOW)).toBeNull();
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), recipient: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u" }, allowed, W_NOW)).toBeNull();
  });

  it("refuses refunds anywhere but an EVM address on the origin chain", () => {
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), refundType: "INTENTS" }, allowed, W_NOW)).toBeNull();
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), refundTo: TRON_TO }, allowed, W_NOW)).toBeNull();
  });

  it("refuses another swap type, slippage, zero amount or a deadline out of range", () => {
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), swapType: "FLEX_INPUT" }, allowed, W_NOW)).toBeNull();
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), slippageTolerance: 5000 }, allowed, W_NOW)).toBeNull();
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), amount: "0" }, allowed, W_NOW)).toBeNull();
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), deadline: "2026-10-04T11:59:00Z" }, allowed, W_NOW)).toBeNull();
    expect(validateWithdrawQuoteRequest({ ...withdrawal(), deadline: "2026-10-04T15:00:00Z" }, allowed, W_NOW)).toBeNull();
  });
});

const QUOTE_BODY = {
  quoteRequest: withdrawal(),
  quote: {
    depositAddress: "0x9f3a00000000000000000000000000000000c21e",
    amountIn: "50000000",
    amountInFormatted: "50.0",
    amountInUsd: "50.00",
    amountOut: "49820000",
    amountOutFormatted: "49.82",
    amountOutUsd: "49.82",
    minAmountOut: "49321800",
    deadline: "2026-10-04T12:30:00.000Z",
    timeEstimate: 60,
  },
};

describe("parseWithdrawEstimate", () => {
  it("keeps what the form shows and needs no address or deadline", () => {
    const { depositAddress, deadline, ...dryQuote } = QUOTE_BODY.quote;
    expect(parseWithdrawEstimate({ quote: dryQuote })).toEqual({
      amountOut: "49820000",
      amountOutFormatted: "49.82",
      minAmountOut: "49321800",
      amountInUsd: "50.00",
      amountOutUsd: "49.82",
      timeEstimate: 60,
    });
    void depositAddress;
    void deadline;
  });

  it("fails loudly when amounts are missing", () => {
    expect(() => parseWithdrawEstimate({ quote: { timeEstimate: 1 } })).toThrow();
  });
});

describe("parseWithdrawQuote", () => {
  it("returns the live quote when Aurora echoes exactly what was sent", () => {
    expect(parseWithdrawQuote(QUOTE_BODY, withdrawal())).toMatchObject({
      depositAddress: QUOTE_BODY.quote.depositAddress,
      amountIn: "50000000",
      deadline: "2026-10-04T12:30:00.000Z",
    });
  });

  it("refuses a quote for another recipient, asset, amount or refund address", () => {
    for (const field of ["recipient", "destinationAsset", "originAsset", "amount", "refundTo"] as const) {
      const body = { ...QUOTE_BODY, quoteRequest: { ...withdrawal(), [field]: "something-else" } };
      expect(() => parseWithdrawQuote(body, withdrawal())).toThrow(WithdrawError);
    }
  });

  it("refuses an amountIn that differs from the request, or a deposit address that is not on Base", () => {
    expect(() => parseWithdrawQuote({ ...QUOTE_BODY, quote: { ...QUOTE_BODY.quote, amountIn: "50000001" } }, withdrawal())).toThrow(WithdrawError);
    expect(() => parseWithdrawQuote({ ...QUOTE_BODY, quote: { ...QUOTE_BODY.quote, depositAddress: TRON_TO } }, withdrawal())).toThrow(WithdrawError);
  });
});

describe("quoteStillHolds", () => {
  const shown = parseWithdrawEstimate(QUOTE_BODY);

  it("holds while the live amount out is at least the minimum the user was shown", () => {
    const quote = parseWithdrawQuote(QUOTE_BODY, withdrawal());
    expect(quoteStillHolds(shown, quote)).toBe(true);
    expect(quoteStillHolds(shown, { ...quote, amountOut: "49321799" })).toBe(false);
  });
});

describe("conversionCostUsd", () => {
  it("is what goes in minus what comes out, in dollars", () => {
    expect(conversionCostUsd(parseWithdrawEstimate(QUOTE_BODY))).toBe("0.18");
  });

  it("is unknown without USD values and never negative", () => {
    expect(conversionCostUsd({ ...parseWithdrawEstimate(QUOTE_BODY), amountInUsd: undefined })).toBeNull();
    expect(conversionCostUsd({ ...parseWithdrawEstimate(QUOTE_BODY), amountOutUsd: "51" })).toBe("0.00");
  });
});

it("leaves at least five minutes to sign", () => {
  expect(SIGN_MARGIN_MS).toBe(5 * 60 * 1000);
});
