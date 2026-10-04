import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", () => ({ FLAGS: { cashPoints: false, card: false, multichainDeposits: false } }));

import { intentsGuard } from "./guard";

describe("intentsGuard with the multichain flag off", () => {
  it("answers 404 before checking the session, so the routes do not exist", async () => {
    const response = await intentsGuard(new Request("http://localhost/api/intents/tokens"), "tokens");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(404);
    expect(await (response as Response).json()).toEqual({ error: "Not found" });
  });
});
