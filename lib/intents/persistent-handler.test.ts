import { getAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { USDC_BASE_ASSET_ID } from "./networks";
import { OwnershipCache, createPersistentAddress, readPersistentHistory, type PersistentDeps } from "./persistent-handler";

const USER_ID = "did:privy:abc";
const WALLET = "0x5aeda56215b167893e80b4fe645ba6d5bab767de";
const TRON_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const BODY = { network: "tron", recipient: WALLET };

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function deps(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, overrides: Partial<PersistentDeps> = {}): PersistentDeps {
  return {
    apiKey: "key",
    fetchImpl: vi.fn(fetchImpl) as unknown as typeof fetch,
    ownsWallet: vi.fn(async () => true),
    ownership: new OwnershipCache(),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("createPersistentAddress", () => {
  it("asks Aurora for the user's address and answers it", async () => {
    const d = deps(async () => respond(200, { depositAddress: TRON_ADDRESS, alreadyExists: false }));
    const result = await createPersistentAddress(BODY, USER_ID, d);

    expect(result).toEqual({ status: 200, body: { depositAddress: TRON_ADDRESS } });
    const [url, init] = vi.mocked(d.fetchImpl!).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://intents-api.aurora.dev/api/persistent-deposit-address/key");
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: getAddress(WALLET),
      sender: USER_ID,
      depositChain: "tron",
      destinationChain: "base",
      destinationAsset: USDC_BASE_ASSET_ID,
      recipientType: "DESTINATION_CHAIN",
      confidential: false,
    });
  });

  it("refuses a recipient that is not the caller's own wallet, before calling Aurora", async () => {
    const d = deps(async () => respond(200, {}), { ownsWallet: vi.fn(async () => false) });
    expect(await createPersistentAddress(BODY, USER_ID, d)).toEqual({ status: 403, body: { error: "Recipient must be your own wallet" } });
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses networks that use one-time quotes", async () => {
    const d = deps(async () => respond(200, {}));
    const result = await createPersistentAddress({ ...BODY, network: "eth" }, USER_ID, d);
    expect(result.status).toBe(400);
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });

  it("skips the wallet check when auth is off", async () => {
    const d = deps(async () => respond(200, { depositAddress: TRON_ADDRESS, alreadyExists: true }));
    expect((await createPersistentAddress(BODY, null, d)).status).toBe(200);
    expect(d.ownsWallet).not.toHaveBeenCalled();
  });

  it("turns Aurora refusing our key into 'unavailable', not a wallet error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps(async () => respond(403, { message: "not approved", statusCode: 403 }));
    expect((await createPersistentAddress(BODY, USER_ID, d)).status).toBe(503);
  });

  it("passes on rate limits and hides other upstream errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await createPersistentAddress(BODY, USER_ID, deps(async () => respond(429, {})))).status).toBe(429);
    expect((await createPersistentAddress(BODY, USER_ID, deps(async () => respond(504, {})))).status).toBe(502);
    expect(
      (
        await createPersistentAddress(
          BODY,
          USER_ID,
          deps(async () => {
            throw new Error("offline");
          })
        )
      ).status
    ).toBe(502);
  });

  it("refuses an answer that is not a Tron address", async () => {
    const d = deps(async () => respond(200, { depositAddress: WALLET, alreadyExists: false }));
    expect((await createPersistentAddress(BODY, USER_ID, d)).status).toBe(502);
  });
});

const DEPOSIT = { tx_hash: "0xa", asset_id: "a", decimals: 6, amount: "1", created_at: "2026-11-16T10:00:00Z", intents_account: "x", deposit_address: TRON_ADDRESS, recipient: WALLET };

/** Answers address-data with `sender` and each status type with its own list. */
function aurora(sender: string | null, lists: Partial<Record<"received" | "success" | "failed", unknown[]>> = {}) {
  return async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/persistent-deposit-address-data/")) {
      return sender === null ? respond(404, { statusCode: 404 }) : respond(200, { depositAddress: TRON_ADDRESS, sender });
    }
    const type = parsed.searchParams.get("type") as "received" | "success" | "failed";
    return respond(200, { deposits: lists[type] ?? [] });
  };
}

describe("readPersistentHistory", () => {
  it("returns the three lists for the address's owner", async () => {
    const d = deps(aurora(USER_ID, { received: [DEPOSIT] }));
    expect(await readPersistentHistory(TRON_ADDRESS, USER_ID, d)).toEqual({
      status: 200,
      body: { received: [DEPOSIT], success: [], failed: [], incomplete: false },
    });
    const urls = vi.mocked(d.fetchImpl!).mock.calls.map(([url]) => String(url));
    expect(urls).toContain(`https://intents-api.aurora.dev/api/persistent-deposit-status/key?address=${TRON_ADDRESS}&type=received&limit=50`);
  });

  it("answers 404 for someone else's address, and for one Aurora does not know", async () => {
    expect((await readPersistentHistory(TRON_ADDRESS, USER_ID, deps(aurora("did:privy:other")))).status).toBe(404);
    expect((await readPersistentHistory(TRON_ADDRESS, USER_ID, deps(aurora(null)))).status).toBe(404);
  });

  it("checks ownership once, then trusts the cache while polling", async () => {
    const d = deps(aurora(USER_ID));
    await readPersistentHistory(TRON_ADDRESS, USER_ID, d);
    await readPersistentHistory(TRON_ADDRESS, USER_ID, d);
    const lookups = vi.mocked(d.fetchImpl!).mock.calls.filter(([url]) => String(url).includes("address-data"));
    expect(lookups).toHaveLength(1);
  });

  it("skips the ownership lookup for an address this user just minted", async () => {
    const ownership = new OwnershipCache();
    await createPersistentAddress(BODY, USER_ID, deps(async () => respond(200, { depositAddress: TRON_ADDRESS, alreadyExists: true }), { ownership }));
    const d = deps(aurora(null), { ownership });
    expect((await readPersistentHistory(TRON_ADDRESS, USER_ID, d)).status).toBe(200);
  });

  it("reports incomplete when any list could not be fully read", async () => {
    const d = deps(async (url) =>
      new URL(url).pathname.includes("address-data")
        ? respond(200, { sender: USER_ID })
        : respond(200, { deposits: [], incomplete: new URL(url).searchParams.get("type") === "received" })
    );
    expect(((await readPersistentHistory(TRON_ADDRESS, USER_ID, d)).body as { incomplete: boolean }).incomplete).toBe(true);
  });

  it("answers 502 when Aurora fails, rather than an empty history", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps(async (url) => (new URL(url).pathname.includes("address-data") ? respond(200, { sender: USER_ID }) : respond(500, {})));
    expect((await readPersistentHistory(TRON_ADDRESS, USER_ID, d)).status).toBe(502);
  });
});

describe("OwnershipCache", () => {
  it("forgets the oldest entry once full", () => {
    const cache = new OwnershipCache(2);
    cache.add("u", "a");
    cache.add("u", "b");
    cache.add("u", "c");
    expect(cache.has("u", "a")).toBe(false);
    expect(cache.has("u", "c")).toBe(true);
  });
});
