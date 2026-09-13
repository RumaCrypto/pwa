import { COUNTRY_OPTIONS, type CurrencyCode as SdkCurrencyCode } from "@p2pdotme/sdk/country";

import { currencyForCountry, type CurrencyCode } from "@/lib/money/currencies";
import { LOCALES, type Language } from "@/lib/i18n/languages";
import { FLAGS, type Flags } from "@/lib/flags";

/** Countries p2p.me can pay out to. Keep in sync with the offramp corridor. */
const SUPPORTED_SENDING_COUNTRIES = ["Colombia", "Peru", "Ecuador", "Venezuela", "Argentina", "Bolivia", "Brazil"];

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

export const COUNTRIES: string[] = COUNTRY_OPTIONS.filter(
  (option) => SUPPORTED_SENDING_COUNTRIES.includes(option.country) && !option.disabled
).map((option) => option.locale.split("-")[1]);

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

/**
 * The p2p.me currency a sell order must quote for this contact's country.
 * Not the same axis as `currencyOf`: Ecuador displays and settles in USD
 * locally, but p2p.me still prices its "ECU" corridor at its own sell price
 * (currently ~0.98, not 1:1) — so this is keyed by country, not currency.
 */
export function sdkCurrencyForCountry(country: string): SdkCurrencyCode {
  const option = COUNTRY_OPTIONS.find((candidate) => candidate.locale.split("-")[1] === country);
  if (!option) throw new Error(`p2p.me has no currency for country ${country}`);
  return option.currency;
}

export function displayName(contact: Contact): string {
  return contact.shortName?.trim() || contact.name.split(" ")[0];
}

export function countryName(country: string, language: Language): string {
  return new Intl.DisplayNames(LOCALES[language], { type: "region" }).of(country) ?? country;
}
