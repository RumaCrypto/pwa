"use client";

import { useState } from "react";
import clsx from "clsx";

import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useContacts } from "@/lib/contacts/contacts-context";
import {
  COUNTRIES,
  countryName,
  localPayoutFieldLabel,
  localPayoutFieldPlaceholder,
  localPayoutFields,
  localPayoutLabel,
  packLocalPayoutReference,
  payoutKindsFor,
  validateLocalPayoutFields,
  type Contact,
  type Payout,
  type PayoutKind,
} from "@/lib/contacts/contacts";
import { mainnetClient } from "@/lib/viem";
import { ensResolver } from "@/lib/usernames/registrar";
import { UsernameNotFoundError, parseRumaRecipient, resolveRumaRecipient } from "@/lib/usernames/recipient";

interface AddContactSheetProps {
  open: boolean;
  onClose: () => void;
  onAdded?: (contact: Contact) => void;
}

export function AddContactSheet({ open, onClose, onAdded }: AddContactSheetProps) {
  const { t, language } = useI18n();
  const { addContact } = useContacts();

  const [name, setName] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [kind, setKind] = useState<PayoutKind>(payoutKindsFor(COUNTRIES[0])[0]);
  const [reference, setReference] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  /** True while a username is being looked up on-chain. */
  const [saving, setSaving] = useState(false);

  const kinds = payoutKindsFor(country);
  const fields = localPayoutFields(country);

  const reset = () => {
    setName("");
    setCountry(COUNTRIES[0]);
    setKind(payoutKindsFor(COUNTRIES[0])[0]);
    setReference("");
    setFieldValues({});
    setError(null);
  };

  const handleCountry = (next: string) => {
    setCountry(next);
    // The previous method may not exist in the new country — Pix outside Brazil.
    const available = payoutKindsFor(next);
    if (!available.includes(kind)) setKind(available[0]);
    // A different country means different local-method fields (or none).
    setFieldValues({});
  };

  const setFieldValue = (key: string, value: string) =>
    setFieldValues((current) => ({ ...current, [key]: value }));

  const rumaPayout = async (): Promise<Payout | string> => {
    const input = parseRumaRecipient(reference);
    switch (input.kind) {
      case "address":
        return { kind: "ruma", reference: input.address };
      case "invalidAddress":
        return t("contacts.add.invalidAddress");
      case "notFound":
        return t("errors.usernameNotFound");
      case "handle":
        try {
          const address = await resolveRumaRecipient(ensResolver(mainnetClient), input.label);
          return { kind: "ruma", reference: address, handle: input.label };
        } catch (err) {
          return err instanceof UsernameNotFoundError ? t("errors.usernameNotFound") : t("errors.usernameResolveFailed");
        }
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) return setError(t("contacts.add.nameRequired"));

    let payout: Payout;
    if (kind === "local") {
      const validationError = validateLocalPayoutFields(country, fieldValues);
      if (validationError) return setError(validationError);
      payout = { kind, reference: packLocalPayoutReference(country, fieldValues) };
    } else {
      if (!reference.trim()) return setError(t("contacts.add.referenceRequired"));
      if (kind === "ruma") {
        setError(null);
        setSaving(true);
        const result = await rumaPayout();
        setSaving(false);
        if (typeof result === "string") return setError(result);
        payout = result;
      } else {
        payout = { kind, reference: reference.trim() };
      }
    }

    const created = addContact({ name: name.trim(), country, payout });

    reset();
    onAdded?.(created);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("contacts.add.title")}
      closeLabel={t("common.cancel")}
      footer={
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("contacts.add.checking") : t("contacts.add.save")}
        </Button>
      }
    >
      <p style={typography.body3} className="mb-5 text-text-secondary">
        {t("contacts.add.subtitle")}
      </p>

      <Field label={t("contacts.add.name")}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("contacts.add.namePlaceholder")}
          autoFocus
        />
      </Field>

      <Field label={t("contacts.add.country")}>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map((code) => (
            <Choice key={code} selected={code === country} onClick={() => handleCountry(code)}>
              {countryName(code, language)}
            </Choice>
          ))}
        </div>
      </Field>

      <Field label={t("contacts.add.method")}>
        <div className="flex flex-wrap gap-2">
          {kinds.map((option) => (
            <Choice key={option} selected={option === kind} onClick={() => setKind(option)}>
              {option === "local"
                ? localPayoutLabel(country)
                : t(`contacts.payout.${option}` as "contacts.payout.ruma" | "contacts.payout.cash")}
            </Choice>
          ))}
        </div>
      </Field>

      {kind === "local" ? (
        fields.map((field) => (
          <Field key={field.key} label={localPayoutFieldLabel(country, field, language)}>
            <Input
              value={fieldValues[field.key] ?? ""}
              onChange={(event) => setFieldValue(field.key, event.target.value)}
              placeholder={localPayoutFieldPlaceholder(country, field, language)}
            />
          </Field>
        ))
      ) : (
        <Field
          label={kind === "ruma" ? t("contacts.add.address") : t("contacts.add.reference")}
          hint={kind === "ruma" ? t("contacts.add.addressHint") : undefined}
        >
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={t(
              `contacts.payout.${kind}.placeholder` as
                | "contacts.payout.ruma.placeholder"
                | "contacts.payout.cash.placeholder"
            )}
          />
        </Field>
      )}

      {error && (
        <p style={typography.body3} className="text-danger">
          {error}
        </p>
      )}
    </Sheet>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <p style={typography.label3} className="mb-2">
        {label}
      </p>
      {children}
      {hint && (
        <p style={typography.body5} className="mt-1.5 text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={typography.label4}
      className={clsx(
        "rounded-full border px-3.5 py-2 transition-colors",
        selected
          ? "border-primary bg-primary-light text-primary-dark"
          : "border-border-light bg-white text-text-secondary"
      )}
    >
      {children}
    </button>
  );
}
