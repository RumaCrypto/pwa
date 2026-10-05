import { describe, expect, it, vi } from "vitest";
import { executeWithdrawal, failedBeforeBroadcast, isUserRejection, type WithdrawDeps } from "./withdraw-execution";
import { getWithdrawal } from "./withdrawals";
import { WithdrawError } from "./withdraw-errors";
import type { WithdrawQuote, WithdrawQuoteRequest } from "./quote";
import type { WithdrawAsset } from "./networks";
import type { WithdrawFee } from "./fee";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const NOW = new Date("2026-10-04T12:00:00Z");
const DEPOSIT = "0x9f3a00000000000000000000000000000000c21e";
const TREASURY = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const HASH = `0x${"ab".repeat(32)}` as const;
const ASSET: WithdrawAsset = { assetId: "a", symbol: "USDT", decimals: 6, priceUsd: 1, network: "tron", contractAddress: null };
const REQUEST = { amount: "50000000" } as WithdrawQuoteRequest;
const QUOTE: WithdrawQuote = {
  depositAddress: DEPOSIT,
  amountIn: "50000000",
  amountInFormatted: "50.0",
  amountOut: "49820000",
  amountOutFormatted: "49.82",
  minAmountOut: "49321800",
  timeEstimate: 60,
  deadline: "2026-10-04T12:30:00.000Z",
};
const NO_FEE: WithdrawFee = { enabled: false, amount: 0n, treasury: null };
const FEE: WithdrawFee = { enabled: true, amount: 100_000n, treasury: TREASURY };

function setup(overrides: Partial<WithdrawDeps> = {}) {
  const deps: WithdrawDeps = {
    storage: memoryStorage(),
    now: () => NOW,
    readBalance: vi.fn(async () => 100_000_000n),
    transfer: vi.fn(async () => HASH),
    waitForReceipt: vi.fn(async () => ({ status: "success" as const })),
    submitTx: vi.fn(async () => {}),
    ...overrides,
  };
  return deps;
}
const input = (overrides = {}) => ({ request: REQUEST, quote: QUOTE, asset: ASSET, confirmedAmount: 50_000_000n, fee: NO_FEE, ...overrides });

describe("executeWithdrawal", () => {
  it("sends exactly the confirmed USDC to the deposit address, then tells Aurora", async () => {
    const deps = setup();
    const withdrawal = await executeWithdrawal(input(), deps);
    expect(deps.transfer).toHaveBeenCalledWith(DEPOSIT, 50_000_000n);
    expect(deps.submitTx).toHaveBeenCalledWith(HASH, DEPOSIT);
    expect(deps.transfer).toHaveBeenNthCalledWith(1, DEPOSIT, 50_000_000n);
    expect(withdrawal).toMatchObject({ phase: "awaiting_deposit", transferTxHash: HASH });
    expect(getWithdrawal(deps.storage, DEPOSIT)?.phase).toBe("awaiting_deposit");
  });

  it("saves the withdrawal before asking for the signature", async () => {
    const deps = setup();
    deps.transfer = vi.fn(async () => {
      expect(getWithdrawal(deps.storage, DEPOSIT)?.phase).toBe("awaiting_transfer");
      return HASH;
    });
    await executeWithdrawal(input(), deps);
  });

  it("signs nothing when the quote's amount differs from what the user confirmed", async () => {
    const deps = setup();
    await expect(executeWithdrawal(input({ confirmedAmount: 49_000_000n }), deps)).rejects.toMatchObject({ code: "mismatch" });
    expect(deps.transfer).not.toHaveBeenCalled();
  });

  it("signs nothing with less than five minutes left on the quote", async () => {
    const deps = setup({ now: () => new Date("2026-10-04T12:26:00Z") });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "expired" });
    expect(deps.transfer).not.toHaveBeenCalled();
  });

  it("signs nothing when the balance no longer covers amount plus fee", async () => {
    const deps = setup({ readBalance: vi.fn(async () => 50_050_000n) });
    await expect(executeWithdrawal(input({ fee: FEE }), deps)).rejects.toMatchObject({ code: "balance" });
    expect(deps.transfer).not.toHaveBeenCalled();
  });

  it("marks it not sent when the user declines the signature", async () => {
    const rejection = Object.assign(new Error("User rejected the request."), { name: "UserRejectedRequestError" });
    const deps = setup({ transfer: vi.fn(async () => Promise.reject(rejection)) });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "rejected" });
    expect(getWithdrawal(deps.storage, DEPOSIT)?.phase).toBe("transfer_failed");
  });

  it("marks it not sent when the transfer fails before broadcast (e.g. no ETH for gas)", async () => {
    const gas = Object.assign(new Error("insufficient funds"), { name: "ContractFunctionExecutionError", cause: { name: "InsufficientFundsError" } });
    const deps = setup({ transfer: vi.fn(async () => Promise.reject(gas)) });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "reverted" });
    expect(getWithdrawal(deps.storage, DEPOSIT)?.phase).toBe("transfer_failed");
  });

  it("keeps it awaiting the transfer when it cannot tell whether it was broadcast", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = setup({ transfer: vi.fn(async () => Promise.reject(new Error("socket hang up"))) });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "unconfirmed" });
    expect(getWithdrawal(deps.storage, DEPOSIT)?.phase).toBe("awaiting_transfer");
    error.mockRestore();
  });

  it.each(["TimeoutError", "HttpRequestError"])("treats viem's wrapper around a %s as unconfirmed, not unsent", async (name) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = Object.assign(new Error("wrapped"), { name: "ContractFunctionExecutionError", cause: { name } });
    const deps = setup({ transfer: vi.fn(async () => Promise.reject(wrapped)) });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "unconfirmed" });
    expect(getWithdrawal(deps.storage, DEPOSIT)?.phase).toBe("awaiting_transfer");
    error.mockRestore();
  });

  it("reports unconfirmed when saving the hash fails after the transfer was signed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const base = memoryStorage();
    let broken = false;
    const storage = {
      getItem: base.getItem,
      setItem: (k: string, v: string) => {
        if (broken) throw new Error("quota");
        base.setItem(k, v);
      },
    };
    const deps = setup({
      storage,
      transfer: vi.fn(async () => {
        broken = true;
        return HASH;
      }),
    });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "unconfirmed" });
    error.mockRestore();
  });

  it("marks it not sent when the transfer reverts on-chain", async () => {
    const deps = setup({ waitForReceipt: vi.fn(async () => ({ status: "reverted" as const })) });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "reverted" });
    expect(getWithdrawal(deps.storage, DEPOSIT)?.phase).toBe("transfer_failed");
  });

  it("does not charge the fee when the transfer reverts", async () => {
    const deps = setup({ waitForReceipt: vi.fn(async () => ({ status: "reverted" as const })) });
    await expect(executeWithdrawal(input({ fee: FEE }), deps)).rejects.toMatchObject({ code: "reverted" });
    expect(deps.transfer).toHaveBeenCalledTimes(1);
  });

  it("skips the fee when it is enabled but has no treasury", async () => {
    const deps = setup();
    await executeWithdrawal(input({ fee: { enabled: true, amount: 100_000n, treasury: null } }), deps);
    expect(deps.transfer).toHaveBeenCalledTimes(1);
  });

  it("leaves it for tracking when the receipt never comes", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = setup({ waitForReceipt: vi.fn(async () => Promise.reject(new Error("timeout"))) });
    await expect(executeWithdrawal(input(), deps)).rejects.toMatchObject({ code: "unconfirmed" });
    expect(getWithdrawal(deps.storage, DEPOSIT)).toMatchObject({ phase: "awaiting_transfer", transferTxHash: HASH });
    error.mockRestore();
  });

  it("does not fail the withdrawal when telling Aurora or charging the fee fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const transfer = vi.fn(async (to: string) => (to === TREASURY ? Promise.reject(new Error("declined")) : HASH));
    const deps = setup({ transfer: transfer as never, submitTx: vi.fn(async () => Promise.reject(new Error("down"))) });
    await expect(executeWithdrawal(input({ fee: FEE }), deps)).resolves.toMatchObject({ phase: "awaiting_deposit" });
    expect(transfer).toHaveBeenLastCalledWith(TREASURY, 100_000n);
    error.mockRestore();
  });
});

describe("error classification", () => {
  it("finds a user rejection anywhere in the cause chain, by name or EIP-1193 code", () => {
    expect(isUserRejection({ name: "X", cause: { name: "UserRejectedRequestError" } })).toBe(true);
    expect(isUserRejection({ code: 4001 })).toBe(true);
    expect(isUserRejection(new Error("nope"))).toBe(false);
  });

  it("knows viem's pre-broadcast failures", () => {
    expect(failedBeforeBroadcast({ name: "EstimateGasExecutionError" })).toBe(true);
    expect(failedBeforeBroadcast(new Error("socket hang up"))).toBe(false);
    expect(failedBeforeBroadcast({ name: "ContractFunctionExecutionError" })).toBe(false);
  });

  it("is a WithdrawError", () => {
    expect(new WithdrawError("balance")).toBeInstanceOf(Error);
  });
});
