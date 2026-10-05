import { describe, expect, it } from "vitest";
import { clearDraft, readDraft, saveDraft, type WithdrawDraft } from "./withdraw-draft";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const DRAFT: WithdrawDraft = {
  asset: { assetId: "a", symbol: "USDT", decimals: 6, priceUsd: 1, network: "tron", contractAddress: null },
  recipient: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  amount: "50000000",
  estimate: { amountOut: "1", amountOutFormatted: "1", minAmountOut: "1", timeEstimate: 60 },
};

describe("withdraw draft", () => {
  it("round-trips and clears", () => {
    const storage = memoryStorage();
    saveDraft(storage, DRAFT);
    expect(readDraft(storage)).toEqual(DRAFT);
    clearDraft(storage);
    expect(readDraft(storage)).toBeNull();
  });

  it("refuses a draft whose address does not fit its network, or a bad amount", () => {
    const storage = memoryStorage();
    saveDraft(storage, { ...DRAFT, recipient: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" });
    expect(readDraft(storage)).toBeNull();
    saveDraft(storage, { ...DRAFT, amount: "0" });
    expect(readDraft(storage)).toBeNull();
    storage.setItem("ruma-withdraw-draft", "not json");
    expect(readDraft(storage)).toBeNull();
  });
});
