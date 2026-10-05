import { describe, expect, it, vi } from "vitest";
import { nearAccountExists } from "./near-account";

const rpc = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("nearAccountExists", () => {
  it("treats implicit accounts as existing without asking the RPC", async () => {
    const fetchImpl = rpc({});
    expect(await nearAccountExists("a".repeat(64), fetchImpl as never)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks the RPC for named accounts", async () => {
    expect(await nearAccountExists("alice.near", rpc({ result: { amount: "1" } }) as never)).toBe(true);
    expect(await nearAccountExists("ghost.near", rpc({ error: { cause: { name: "UNKNOWN_ACCOUNT" } } }) as never)).toBe(false);
  });

  it("throws when the RPC cannot answer, rather than guessing", async () => {
    await expect(nearAccountExists("alice.near", rpc({ error: { cause: { name: "TIMEOUT_ERROR" } } }) as never)).rejects.toThrow();
    await expect(nearAccountExists("alice.near", rpc({}, 503) as never)).rejects.toThrow();
  });
});
