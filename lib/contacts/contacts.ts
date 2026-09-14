import { CURRENCIES, CURRENCY_CODES, currencyForCountry, type CurrencyCode } from "@/lib/money/currencies";
import { LOCALES, type Language } from "@/lib/i18n/languages";
import { FLAGS, type Flags } from "@/lib/flags";
import { isSupportedCountry } from "@/lib/p2p/markets";

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

/** Every country in the currency catalogue, whether or not money can reach it. */
export const CATALOGUE_COUNTRIES: string[] = CURRENCY_CODES.flatMap(
  (code) => CURRENCIES[code].countries as readonly string[]
);

/**
 * Countries a contact can be created in. Filtered by payout coverage rather
 * than by a hardcoded exclusion list, so a country appears the moment p2p.me
 * has a market for it — and never appears without one, which would let someone
 * save a contact who could never be paid.
 */
export const COUNTRIES: string[] = CATALOGUE_COUNTRIES.filter(isSupportedCountry);

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
