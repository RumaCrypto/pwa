import { describe, expect, it } from "vitest";
import { baseTxUrl, explorerTxUrl } from "./explorers";

const EVM_HASH = `0x${"ab".repeat(32)}`;
const HEX_HASH = "ab".repeat(32);

describe("explorerTxUrl", () => {
  it("builds the link from a fixed base per network", () => {
    expect(explorerTxUrl("eth", EVM_HASH)).toBe(`https://etherscan.io/tx/${EVM_HASH}`);
    expect(explorerTxUrl("arb", EVM_HASH)).toBe(`https://arbiscan.io/tx/${EVM_HASH}`);
    expect(explorerTxUrl("op", EVM_HASH)).toBe(`https://optimistic.etherscan.io/tx/${EVM_HASH}`);
    expect(explorerTxUrl("tron", HEX_HASH)).toBe(`https://tronscan.org/#/transaction/${HEX_HASH}`);
    expect(explorerTxUrl("tron", `0x${HEX_HASH}`)).toBe(`https://tronscan.org/#/transaction/${HEX_HASH}`);
    expect(explorerTxUrl("btc", HEX_HASH)).toBe(`https://mempool.space/tx/${HEX_HASH}`);
    expect(explorerTxUrl("near", "8xYh1nTv8bXqfF2r9J3WvH4kzMh5dKq2tYc7nE1aBcDe")).toBe(
      "https://nearblocks.io/txns/8xYh1nTv8bXqfF2r9J3WvH4kzMh5dKq2tYc7nE1aBcDe"
    );
  });

  it("refuses anything that is not a hash, so Aurora's data can never become a link elsewhere", () => {
    expect(explorerTxUrl("eth", "javascript:alert(1)")).toBeNull();
    expect(explorerTxUrl("btc", `${HEX_HASH}/../../evil`)).toBeNull();
    expect(explorerTxUrl("near", "https://evil.example")).toBeNull();
  });
});

describe("baseTxUrl", () => {
  it("links a Base transaction on BaseScan", () => {
    const hash = `0x${"ab".repeat(32)}`;
    expect(baseTxUrl(hash)).toBe(`https://basescan.org/tx/${hash}`);
  });

  it("refuses anything that isn't a transaction hash", () => {
    expect(baseTxUrl("javascript:alert(1)")).toBeNull();
    expect(baseTxUrl("0x1234")).toBeNull();
  });
});
