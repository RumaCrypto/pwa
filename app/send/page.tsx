"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, QrCode, Search } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { AddContactSheet } from "@/components/contacts/add-contact-sheet";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useContacts } from "@/lib/contacts/contacts-context";
import { countryName, displayName, type Contact } from "@/lib/contacts/contacts";
import { useSend } from "@/lib/send/send-context";

export default function SendRecipientStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { contacts } = useContacts();
  const { setContactId } = useSend();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.shortName ?? "", contact.payout.reference]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [contacts, query]);

  const choose = (contact: Contact) => {
    setContactId(contact.id);
    router.push("/send/amount");
  };

  return (
    <Screen
      title={t("sendFlow.step1.title")}
      backLabel={t("common.back")}
      step={{ current: 1, total: 3 }}
    >
      <Card divided>
        <ListRow
          leading={<Dot><Plus size={16} /></Dot>}
          title={t("sendFlow.step1.addNew")}
          subtitle={t("sendFlow.step1.addNewHint")}
          chevron
          onClick={() => setAdding(true)}
        />
        <ListRow
          leading={<Dot><QrCode size={16} /></Dot>}
          title={t("sendFlow.step1.scanQr")}
          subtitle={t("sendFlow.step1.scanQrHint")}
          chevron
          onClick={() => router.push("/pay")}
        />
      </Card>

      <Input
        className="mt-5"
        leading={<Search size={18} className="shrink-0 text-text-secondary" />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("sendFlow.step1.search")}
      />

      <h2 style={typography.heading3} className="mb-3 mt-8">
        {t("sendFlow.step1.frequent")}
      </h2>

      {matches.length > 0 ? (
        <Card divided>
          {matches.map((contact) => (
            <ListRow
              key={contact.id}
              leading={<Avatar name={displayName(contact)} />}
              title={contact.name}
              subtitle={`${countryName(contact.country, language)} · ${t(
                `contacts.payout.${contact.payout.kind}` as "contacts.payout.pix"
              )} ·· ${contact.payout.reference}`}
              chevron
              onClick={() => choose(contact)}
            />
          ))}
        </Card>
      ) : (
        <p style={typography.body3} className="text-text-secondary">
          {t("contacts.empty")}
        </p>
      )}

      <p style={typography.body5} className="mt-8 text-center text-text-secondary">
        {t("sendFlow.step1.footnote")}
      </p>

      <AddContactSheet open={adding} onClose={() => setAdding(false)} onAdded={choose} />
    </Screen>
  );
}

function Dot({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white">
      {children}
    </span>
  );
}
