import {
  COUNTRY_OPTIONS,
  PAYMENT_ID_FIELDS,
  deserializeCompoundPaymentId,
  packStoredPaymentId,
  validateStoredPaymentId,
  type CurrencyCode as SdkCurrencyCode,
  type PaymentIdFieldConfig,
} from "@p2pdotme/sdk/country";

import { CURRENCIES, CURRENCY_CODES, currencyForCountry, type CurrencyCode } from "@/lib/money/currencies";
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

interface LocalPayoutFieldOverride {
  readonly label: Record<Language, string>;
  readonly placeholder: Record<Language, string>;
}

/**
 * Overrides for a local-method field's label and placeholder, keyed by
 * country then by `PaymentIdFieldConfig.key`. p2p.me's own `displayLabel` /
 * `placeholder` are English-only and inconsistently worded across countries
 * (e.g. Colombia's field is labeled "Nequi / Daviplata / Bre-B") — this is
 * the single place to fix wording or add a language without touching the
 * SDK. A field left out of a country's map falls back to the SDK's default,
 * untranslated.
 */
const LOCAL_PAYOUT_FIELD_OVERRIDES: Record<string, Record<string, LocalPayoutFieldOverride>> = {
  BR: {
    pix: {
      label: { en: "Pix key", es: "Clave Pix", pt: "Chave Pix" },
      placeholder: {
        en: "Pix key, email, phone, or code",
        es: "Clave Pix, correo, teléfono o código",
        pt: "Chave Pix, e-mail, telefone ou código",
      },
    },
  },
  AR: {
    alias: {
      label: { en: "Alias / CBU", es: "Alias / CBU", pt: "Alias / CBU" },
      placeholder: { en: "juan.perez", es: "juan.perez", pt: "juan.perez" },
    },
  },
  VE: {
    phone: {
      label: { en: "Phone number", es: "Número de teléfono", pt: "Número de telefone" },
      placeholder: { en: "04121234567", es: "04121234567", pt: "04121234567" },
    },
    rif: {
      label: { en: "Cédula / RIF", es: "Cédula / RIF", pt: "Cédula / RIF" },
      placeholder: { en: "V12345678", es: "V12345678", pt: "V12345678" },
    },
    bank: {
      label: { en: "Bank", es: "Banco", pt: "Banco" },
      placeholder: { en: "Banesco", es: "Banesco", pt: "Banesco" },
    },
  },
  BO: {
    account: {
      label: { en: "Account number", es: "Número de cuenta", pt: "Número da conta" },
      placeholder: {
        en: "8–20 digit account number",
        es: "Número de cuenta (8 a 20 dígitos)",
        pt: "Número da conta (8 a 20 dígitos)",
      },
    },
  },
  CO: {
    alias: {
      label: {
        en: "Bre-B key",
        es: "Llave Bre-B",
        pt: "Llave Bre-B",
      },
      placeholder: {
        en: "@jhon.doe",
        es: "@juan.perez",
        pt: "@juan.pereira",
      },
    },
  },
  EC: {
    "bank-name": {
      label: { en: "Bank", es: "Banco", pt: "Banco" },
      placeholder: { en: "Banco Pichincha", es: "Banco Pichincha", pt: "Banco Pichincha" },
    },
    "account-type": {
      label: { en: "Account type", es: "Tipo de cuenta", pt: "Tipo de conta" },
      placeholder: { en: "Savings or checking", es: "Ahorros o corriente", pt: "Poupança ou corrente" },
    },
    "account-number": {
      label: { en: "Account number", es: "Número de cuenta", pt: "Número da conta" },
      placeholder: { en: "2100123456", es: "2100123456", pt: "2100123456" },
    },
    "account-name": {
      label: { en: "Account holder name", es: "Nombre del titular", pt: "Nome do titular" },
      placeholder: { en: "Juan Pérez", es: "Juan Pérez", pt: "Juan Pérez" },
    },
    cedula: {
      label: { en: "Cédula / RUC", es: "Cédula / RUC", pt: "Cédula / RUC" },
      placeholder: { en: "1710034065", es: "1710034065", pt: "1710034065" },
    },
  },
  PE: {
    phone: {
      label: { en: "Yape / Plin phone", es: "Teléfono Yape / Plin", pt: "Telefone Yape / Plin" },
      placeholder: { en: "987654321", es: "987654321", pt: "987654321" },
    },
    cci: {
      label: { en: "CCI", es: "CCI", pt: "CCI" },
      placeholder: { en: "20-digit CCI", es: "CCI de 20 dígitos", pt: "CCI de 20 dígitos" },
    },
  },
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

/** Every country in the currency catalogue, whether or not money can reach it. */
export const CATALOGUE_COUNTRIES: string[] = CURRENCY_CODES.flatMap(
  (code) => CURRENCIES[code].countries as readonly string[]
);

/**
 * Countries a contact can be created in. Taken from p2p.me's own country list
 * minus the corridors it has disabled, so a country never appears without a
 * payout market — which would let someone save a contact who could never be
 * paid.
 */
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

/** Display label for a local-method field, overridden per `LOCAL_PAYOUT_FIELD_OVERRIDES` when set. */
export function localPayoutFieldLabel(country: string, field: PaymentIdFieldConfig, language: Language): string {
  return LOCAL_PAYOUT_FIELD_OVERRIDES[country]?.[field.key]?.label[language] ?? field.displayLabel ?? field.label;
}

/** Input placeholder for a local-method field, overridden per `LOCAL_PAYOUT_FIELD_OVERRIDES` when set. */
export function localPayoutFieldPlaceholder(country: string, field: PaymentIdFieldConfig, language: Language): string {
  return LOCAL_PAYOUT_FIELD_OVERRIDES[country]?.[field.key]?.placeholder[language] ?? field.placeholder;
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

/**
 * Human-readable form of a stored local-method reference, using our own
 * field labels (see `localPayoutFieldLabel`) rather than p2p.me's.
 */
export function formatLocalPayoutReference(country: string, reference: string, language: Language): string {
  const fields = localPayoutFields(country);
  if (fields.length <= 1) return reference;

  const parts = deserializeCompoundPaymentId(reference);
  return fields
    .map((field, i) => {
      const value = (parts[i] ?? "").trim();
      return value ? `${localPayoutFieldLabel(country, field, language)}: ${value}` : null;
    })
    .filter((part): part is string => part !== null)
    .join(" | ");
}

/** Human-readable form of a contact's payout reference — labeled fields for local methods, verbatim otherwise. */
export function payoutReferenceDisplay(contact: Contact, language: Language): string {
  if (contact.payout.kind !== "local") return contact.payout.reference;
  return formatLocalPayoutReference(contact.country, contact.payout.reference, language) || contact.payout.reference;
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
