import { describe, expect, it, vi } from "vitest";
import {
  IntentsApiError,
  fetchDepositStatus,
  requestDepositQuote,
  requestWithdrawEstimate,
  requestWithdrawQuote,
  submitDepositTx,
} from "./api";
import type { QuoteRequest } from "./quote";

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
    await requestWithdrawEstimate(request, "tok", signal, fetchImpl as never);
    expect(fetchImpl).toHaveBeenCalledWith("/api/intents/quote/dry", expect.objectContaining({ method: "POST", signal }));
  });

  it("posts the tx hash and deposit address to the submit route", async () => {
    const fetchImpl = ok({});
    await submitDepositTx(`0x${"ab".repeat(32)}`, "0x9f3a00000000000000000000000000000000c21e", "tok", fetchImpl as never);
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
