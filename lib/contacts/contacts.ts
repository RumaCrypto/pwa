import { CURRENCIES, CURRENCY_CODES, currencyForCountry, type CurrencyCode } from "@/lib/money/currencies";
import { LOCALES, type Language } from "@/lib/i18n/languages";
import { FLAGS, type Flags } from "@/lib/flags";

export type PayoutKind = "ruma" | "cash" | "pix" | "nequi";

/** How a contact receives money. `reference` is the Pix key, phone, or username. */
export interface Payout {
  kind: PayoutKind;
  reference: string;
}

export interface Contact {
  id: string;
  name: string;
  /** What the home strip shows, and what the avatar initials derive from. */
  shortName?: string;
  country: string;
  payout: Payout;
}

export const COUNTRIES: string[] = CURRENCY_CODES.flatMap(
  (code) => CURRENCIES[code].countries as readonly string[]
);

/** Pix exists only in Brazil and Nequi only in Colombia; the rest are universal. */
export function payoutKindsFor(country: string, flags: Flags = FLAGS): PayoutKind[] {
  // Cash payout depends on Ruma points, which do not exist yet.
  const universal: PayoutKind[] = flags.cashPoints ? ["ruma", "cash"] : ["ruma"];
  if (country === "BR") return ["pix", ...universal];
  if (country === "CO") return ["nequi", ...universal];
  return universal;
}

export function currencyOf(contact: Contact): CurrencyCode {
  return currencyForCountry(contact.country) ?? "USD";
}

export function displayName(contact: Contact): string {
  return contact.shortName?.trim() || contact.name.split(" ")[0];
}

export function countryName(country: string, language: Language): string {
  return new Intl.DisplayNames(LOCALES[language], { type: "region" }).of(country) ?? country;
}
