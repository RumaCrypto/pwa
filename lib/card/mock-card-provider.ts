import { fromNumber } from "@/lib/money/money";
import type { Card, CardSetup, CardStatus, SpendingControls } from "./card";
import type { CardProvider, CardSecrets } from "./card-provider";

const SETUP_KEY = "ruma-card-setup";
const CONTROLS_KEY = "ruma-card-controls";

const BLANK: CardSetup = { kyc: "not_started", endorsement: "not_requested" };

const DEFAULT_CONTROLS: SpendingControls = {
  monthlyLimit: fromNumber(500, "USD"),
  perPurchaseLimit: fromNumber(150, "USD"),
  onlinePurchases: true,
};

const latency = () => new Promise((resolve) => setTimeout(resolve, 500));

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw, reviveBigints) as T) : fallback;
  } catch {
    return fallback;
  }
}

function reviveBigints(_key: string, value: unknown) {
  if (value && typeof value === "object" && "amount" in value && typeof value.amount === "string") {
    return { ...value, amount: BigInt(value.amount) };
  }
  return value;
}

function write(key: string, value: unknown): void {
  localStorage.setItem(
    key,
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

function save(setup: CardSetup): CardSetup {
  write(SETUP_KEY, setup);
  return setup;
}

/**
 * Stands in for Bridge and Stripe Issuing so the screens can be built and used.
 * Every method here is one call to replace; the sequencing rules live in
 * `nextSetupStep`, not in this object.
 */
export const mockCardProvider: CardProvider = {
  async getSetup() {
    return read<CardSetup>(SETUP_KEY, BLANK);
  },

  async startKyc() {
    await latency();
    return save({ ...read<CardSetup>(SETUP_KEY, BLANK), kyc: "approved" });
  },

  async requestEndorsement() {
    await latency();
    return save({ ...read<CardSetup>(SETUP_KEY, BLANK), endorsement: "approved" });
  },

  async buildApproval() {
    // The real call is an ERC-20 approve to Bridge's spender contract.
    return { to: "0x0000000000000000000000000000000000000000", data: "0x" };
  },

  async recordApproval(txHash: string) {
    return save({ ...read<CardSetup>(SETUP_KEY, BLANK), approvalTxHash: txHash });
  },

  async createCard(type: Card["type"]) {
    await latency();
    const card: Card = {
      id: `ic_${Math.random().toString(36).slice(2, 10)}`,
      last4: String(Math.floor(1000 + Math.random() * 9000)),
      brand: "visa",
      type,
      status: "active",
      expiryMonth: 9,
      expiryYear: new Date().getFullYear() + 4,
      holder: "RUMA CARDHOLDER",
    };
    return save({ ...read<CardSetup>(SETUP_KEY, BLANK), card });
  },

  async setStatus(status: CardStatus) {
    const setup = read<CardSetup>(SETUP_KEY, BLANK);
    if (!setup.card) return setup;
    return save({ ...setup, card: { ...setup.card, status } });
  },

  async getSpendingControls() {
    return read<SpendingControls>(CONTROLS_KEY, DEFAULT_CONTROLS);
  },

  async setSpendingControls(controls: Partial<SpendingControls>) {
    const next = { ...read<SpendingControls>(CONTROLS_KEY, DEFAULT_CONTROLS), ...controls };
    write(CONTROLS_KEY, next);
    return next;
  },

  async revealDetails(): Promise<CardSecrets> {
    await latency();
    const setup = read<CardSetup>(SETUP_KEY, BLANK);
    // Deliberately not a valid card number: nothing here should ever look real
    // enough to be mistaken for a credential.
    return {
      pan: `0000 0000 0000 ${setup.card?.last4 ?? "0000"}`,
      cvv: "000",
      expiry: setup.card ? `${String(setup.card.expiryMonth).padStart(2, "0")}/${String(setup.card.expiryYear).slice(-2)}` : "00/00",
    };
  },
};
