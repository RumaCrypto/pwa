"use client";

import { useState } from "react";
import clsx from "clsx";

import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useContacts } from "@/lib/contacts/contacts-context";
import { COUNTRIES, countryName, payoutKindsFor, type Contact, type PayoutKind } from "@/lib/contacts/contacts";

interface AddContactSheetProps {
  open: boolean;
  onClose: () => void;
  onAdded?: (contact: Contact) => void;
}

export function AddContactSheet({ open, onClose, onAdded }: AddContactSheetProps) {
  const { t, language } = useI18n();
  const { addContact } = useContacts();

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [kind, setKind] = useState<PayoutKind>(payoutKindsFor(COUNTRIES[0])[0]);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const kinds = payoutKindsFor(country);

  const reset = () => {
    setName("");
    setShortName("");
    setCountry(COUNTRIES[0]);
    setKind(payoutKindsFor(COUNTRIES[0])[0]);
    setReference("");
    setError(null);
  };

  const handleCountry = (next: string) => {
    setCountry(next);
    // The previous method may not exist in the new country — Pix outside Brazil.
    const available = payoutKindsFor(next);
    if (!available.includes(kind)) setKind(available[0]);
  };

  const handleSave = () => {
    if (!name.trim()) return setError(t("contacts.add.nameRequired"));
    if (!reference.trim()) return setError(t("contacts.add.referenceRequired"));

    const created = addContact({
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      country,
      payout: { kind, reference: reference.trim() },
    });

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
      footer={<Button onClick={handleSave}>{t("contacts.add.save")}</Button>}
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

      <Field label={t("contacts.add.shortName")} hint={t("contacts.add.shortNameHint")}>
        <Input
          value={shortName}
          onChange={(event) => setShortName(event.target.value)}
          placeholder={t("contacts.add.shortNamePlaceholder")}
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
              {t(`contacts.payout.${option}` as `contacts.payout.${PayoutKind}`)}
            </Choice>
          ))}
        </div>
      </Field>

      <Field label={t("contacts.add.reference")}>
        <Input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={t(`contacts.payout.${kind}.placeholder` as `contacts.payout.${PayoutKind}.placeholder`)}
        />
      </Field>

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
