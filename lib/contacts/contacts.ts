import {
  COUNTRY_OPTIONS,
  PAYMENT_ID_FIELDS,
  formatStoredPaymentIdForDisplay,
  packStoredPaymentId,
  validateStoredPaymentId,
  type CurrencyCode as SdkCurrencyCode,
  type PaymentIdFieldConfig,
} from "@p2pdotme/sdk/country";

import { currencyForCountry, type CurrencyCode } from "@/lib/money/currencies";
import { LOCALES, type Language } from "@/lib/i18n/languages";
import { FLAGS, type Flags } from "@/lib/flags";

/** Countries p2p.me can pay out to. Keep in sync with the offramp corridor. */
const SUPPORTED_SENDING_COUNTRIES = ["Colombia", "Peru", "Ecuador", "Venezuela", "Argentina", "Bolivia", "Brazil"];

/**
 * The local payout method p2p.me merchants use to settle each country's sell
 * corridor (COUNTRY_OPTIONS.paymentMethod), labeled the way locals actually
 * recognize it. p2p.me's raw codes aren't display-ready, and some collide
 * across countries — Colombia and Ecuador both report "TRANSFERENCIA".
 */
const LOCAL_PAYOUT_METHODS: Record<string, string> = {
  BR: "PIX", // p2p.me: PIX
  AR: "MercadoPago", // p2p.me: ALIAS
  VE: "PagoMovil", // p2p.me: PAGO_MOVIL
  BO: "QR Simple", // p2p.me: QR_SIMPLE
  CO: "Bre-B", // p2p.me: TRANSFERENCIA
  EC: "Banco", // p2p.me: TRANSFERENCIA
  PE: "Yape / Plin", // p2p.me: YAPE_PLIN_CCI
};

export type PayoutKind = "ruma" | "cash" | "local";

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

/** Offers the country's p2p.me local payout method alongside Ruma and (once enabled) cash. */
export function payoutKindsFor(country: string, flags: Flags = FLAGS): PayoutKind[] {
  // Cash payout depends on Ruma points, which do not exist yet.
  const universal: PayoutKind[] = flags.cashPoints ? ["ruma", "cash"] : ["ruma"];
  return LOCAL_PAYOUT_METHODS[country] ? ["local", ...universal] : universal;
}

/** Display name for a country's p2p.me local payout method, e.g. "PagoMovil" for Venezuela. */
export function localPayoutLabel(country: string): string | undefined {
  return LOCAL_PAYOUT_METHODS[country];
}

/**
 * The typed fields p2p.me needs to place a sell order through this country's
 * local method — one field for Bre-B (an alias), five for Ecuador's bank
 * transfer (bank, account type, account number, name, cédula).
 */
export function localPayoutFields(country: string): readonly PaymentIdFieldConfig[] {
  return PAYMENT_ID_FIELDS[sdkCurrencyForCountry(country)] ?? [];
}

/** Packs a country's local-method field values into the string stored as `Payout.reference`. */
export function packLocalPayoutReference(country: string, fieldValues: Record<string, string>): string {
  return packStoredPaymentId(sdkCurrencyForCountry(country), null, fieldValues);
}

/**
 * Validates local-method field values against p2p.me's rules for the
 * country, returning the first failing field's error message, or null once
 * the values would place a valid sell order.
 */
export function validateLocalPayoutFields(country: string, fieldValues: Record<string, string>): string | null {
  const currency = sdkCurrencyForCountry(country);
  if (validateStoredPaymentId(currency, packStoredPaymentId(currency, null, fieldValues))) return null;

  const fields = localPayoutFields(country);
  const blank = fields.find((field) => !field.optional && !(fieldValues[field.key] ?? "").trim());
  if (blank) return blank.validationErrorMessage;

  const invalid = fields.find((field) => {
    const value = (fieldValues[field.key] ?? "").trim();
    return value.length > 0 && !field.validate(value);
  });
  return invalid?.validationErrorMessage ?? fields[0]?.validationErrorMessage ?? null;
}

/** Human-readable form of a stored local-method reference, e.g. labeled fields for Ecuador's bank transfer. */
export function formatLocalPayoutReference(country: string, reference: string): string {
  return formatStoredPaymentIdForDisplay(sdkCurrencyForCountry(country), reference);
}

/** Human-readable form of a contact's payout reference — labeled fields for local methods, verbatim otherwise. */
export function payoutReferenceDisplay(contact: Contact): string {
  if (contact.payout.kind !== "local") return contact.payout.reference;
  return formatLocalPayoutReference(contact.country, contact.payout.reference) || contact.payout.reference;
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
