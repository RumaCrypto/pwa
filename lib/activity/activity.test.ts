import { describe, expect, it } from "vitest";
import { emptyActivityProvider } from "./activity";

describe("emptyActivityProvider", () => {
  it("lists nothing, so a missing Alchemy key never shows made-up movements", async () => {
    expect(await emptyActivityProvider.list("0xabc")).toEqual([]);
  });
});
