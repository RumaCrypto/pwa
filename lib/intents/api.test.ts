import { describe, expect, it, vi } from "vitest";
import { fetchDepositStatus, requestDepositQuote } from "./api";
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
