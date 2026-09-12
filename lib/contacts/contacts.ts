import type { CurrencyCode } from "@/lib/money/currencies";

/** How a contact receives money in their country. */
export type PayoutMethod =
  | { kind: "pix"; key: string }
  | { kind: "nequi"; phone: string }
  | { kind: "cash"; point: string }
  | { kind: "ruma"; username: string };

export interface Contact {
  id: string;
  name: string;
  /** Shown on the home row; falls back to the first name. */
  shortName?: string;
  /** Overrides the initials derived from the name — "Juan Carlos Vera" shows JC. */
  initials?: string;
  country: string;
  currency: CurrencyCode;
  payout: PayoutMethod;
}

/**
 * Contacts live in memory for now. When a backend exists, only this module
 * changes — callers already go through `listContacts`.
 */
const CONTACTS: Contact[] = [
  {
    id: "rosa",
    name: "Rosa Cedeño",
    shortName: "Rosa",
    country: "BR",
    currency: "BRL",
    payout: { kind: "pix", key: "4417" },
  },
  {
    id: "diego",
    name: "Diego Cedeño",
    shortName: "Diego",
    country: "CO",
    currency: "COP",
    payout: { kind: "cash", point: "Punto Ruma" },
  },
  {
    id: "mama",
    name: "Mamá",
    country: "CO",
    currency: "COP",
    payout: { kind: "nequi", phone: "8820" },
  },
  {
    id: "juan-carlos",
    name: "Juan Carlos Vera",
    shortName: "J. Carlos",
    initials: "JC",
    country: "EC",
    currency: "USD",
    payout: { kind: "ruma", username: "jcvera" },
  },
];

export function listContacts(): Contact[] {
  return CONTACTS;
}

export function findContact(id: string): Contact | undefined {
  return CONTACTS.find((contact) => contact.id === id);
}
