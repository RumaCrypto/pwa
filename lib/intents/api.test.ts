import { describe, expect, it, vi } from "vitest";
import {
  IntentsApiError,
  fetchDepositStatus,
  fetchPersistentHistory,
  fetchTokens,
  requestDepositQuote,
  requestPersistentAddress,
  requestWithdrawEstimate,
  requestWithdrawQuote,
  submitDepositTx,
} from "./api";
import { parseWithdrawEstimate, type QuoteRequest } from "./quote";

const json = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const REQUEST = { amount: "1" } as QuoteRequest;

describe("requestDepositQuote", () => {
  it("posts to our quote route and returns the parsed quote", async () => {
    const fetchImpl = json(200, {
      quote: {
        depositAddress: "TXyz",
        amountInFormatted: "1",
        minAmountIn: "990000",
        amountOutFormatted: "0.99",
        minAmountOut: "980000",
        deadline: "2026-10-04T13:00:00.000Z",
        timeEstimate: 60,
      },
    });

    const quote = await requestDepositQuote(REQUEST, "tok", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/intents/quote",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer tok" }) })
    );
    expect(quote.depositAddress).toBe("TXyz");
  });

  it("surfaces Aurora's own message, e.g. an amount below the minimum", async () => {
    await expect(requestDepositQuote(REQUEST, "tok", json(400, { message: "Amount is too low" }))).rejects.toThrow(
      "Amount is too low"
    );
  });

  it("keeps the HTTP status on the error so the screen can translate it", async () => {
    const error = await requestDepositQuote(REQUEST, "tok", json(429, { error: "Too many requests" })).catch((e) => e);
    expect(error).toBeInstanceOf(IntentsApiError);
    expect(error).toMatchObject({ status: 429, message: "Too many requests" });
  });
});

describe("fetchDepositStatus", () => {
  it("asks our status route for the address", async () => {
    const fetchImpl = json(200, { status: "PROCESSING" });

    expect(await fetchDepositStatus("TXyz", undefined, "tok", fetchImpl)).toEqual({ status: "PROCESSING" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/intents/status?depositAddress=TXyz", {
      headers: { Authorization: "Bearer tok" },
    });
  });
});

describe("withdrawal calls", () => {
  const request = { amount: "1", recipient: "r", refundTo: "0x1", originAsset: "o", destinationAsset: "d" } as never;
  const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

  it("asks the dry route for estimates and passes the abort signal", async () => {
    const fetchImpl = ok({ quote: { amountOut: "1", amountOutFormatted: "1", minAmountOut: "1", timeEstimate: 1 } });
    const signal = new AbortController().signal;
    const estimate = await requestWithdrawEstimate(request, "tok", signal, fetchImpl as never);
    expect(estimate).toEqual(parseWithdrawEstimate({ quote: { amountOut: "1", amountOutFormatted: "1", minAmountOut: "1", timeEstimate: 1 } }));
    expect(fetchImpl).toHaveBeenCalledWith("/api/intents/quote/dry", expect.objectContaining({ method: "POST", signal }));
  });

  it("posts the tx hash and deposit address to the submit route", async () => {
    const fetchImpl = ok({});
    const txHash = `0x${"ab".repeat(32)}`;
    const depositAddress = "0x9f3a00000000000000000000000000000000c21e";
    await submitDepositTx(txHash, depositAddress, "tok", fetchImpl as never);
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ txHash, depositAddress });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/intents/submit",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer tok" }) })
    );
  });

  it("raises IntentsApiError with the status on refusal", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "Recipient is a token contract" }), { status: 422 }));
    await expect(requestWithdrawQuote(request, "tok", fetchImpl as never)).rejects.toMatchObject({ status: 422 });
  });
});

describe("fetchTokens", () => {
  const TOKEN = { assetId: "nep141:wrap.near", decimals: 24, blockchain: "near", symbol: "wNEAR", price: 5, contractAddress: "wrap.near" };

  it("unwraps the token list from Aurora's { asset_stats, tokens } envelope", async () => {
    const tokens = await fetchTokens("tok", json(200, { asset_stats: [], tokens: [TOKEN] }));
    expect(tokens).toEqual([TOKEN]);
  });

  it("still accepts a bare array", async () => {
    expect(await fetchTokens("tok", json(200, [TOKEN]))).toEqual([TOKEN]);
  });

  it("fails loudly on a body with no token list", async () => {
    await expect(fetchTokens("tok", json(200, { asset_stats: [] }))).rejects.toThrow(/token list/);
  });
});

describe("requestPersistentAddress", () => {
  it("posts the network and wallet to our route and returns the address", async () => {
    const fetchImpl = json(200, { depositAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" });
    const result = await requestPersistentAddress("tron", "0x5aeda56215b167893e80b4fe645ba6d5bab767de", "tok", fetchImpl);
    expect(result).toEqual({ depositAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/intents/persistent-address");
    expect(JSON.parse(init.body as string)).toEqual({ network: "tron", recipient: "0x5aeda56215b167893e80b4fe645ba6d5bab767de" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("keeps the status of a refusal", async () => {
    await expect(requestPersistentAddress("tron", "0x1", null, json(403, { error: "Recipient must be your own wallet" }))).rejects.toMatchObject({
      status: 403,
    });
  });

  // The regression: the screen's effect runs twice (StrictMode, dependency
  // changes) and Aurora answers 429 to a second mint of the same address while
  // the first is in flight, so a new user saw "too many attempts".
  it("sends one request when the same address is asked for concurrently", async () => {
    const fetchImpl = json(200, { depositAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" });
    const wallet = "0x00000000000000000000000000000000000000aa";
    const [first, second] = await Promise.all([
      requestPersistentAddress("tron", wallet, "tok", fetchImpl),
      requestPersistentAddress("tron", wallet, "tok", fetchImpl),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("asks again once the previous request has settled, so retrying after a failure works", async () => {
    const wallet = "0x00000000000000000000000000000000000000bb";
    await expect(requestPersistentAddress("tron", wallet, "tok", json(429, { error: "Too many requests" }))).rejects.toMatchObject({ status: 429 });
    const retry = json(200, { depositAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" });
    await expect(requestPersistentAddress("tron", wallet, "tok", retry)).resolves.toEqual({ depositAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" });
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("fetchPersistentHistory", () => {
  it("reads the history of an address", async () => {
    const fetchImpl = json(200, { received: [], success: [], failed: [], incomplete: false });
    expect(await fetchPersistentHistory("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", null, fetchImpl)).toEqual({
      received: [],
      success: [],
      failed: [],
      incomplete: false,
    });
    expect(vi.mocked(fetchImpl).mock.calls[0][0]).toBe("/api/intents/persistent-status?address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
  });
});
