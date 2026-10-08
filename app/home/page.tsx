"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Plus, Settings, Store } from "lucide-react";
import clsx from "clsx";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { StatusCard } from "@/components/ui/status-card";
import { PaymentCard } from "@/components/ui/payment-card";
import { Carousel } from "@/components/ui/carousel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ListRow } from "@/components/ui/list-row";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { useConverted, useMoney } from "@/lib/money/money-context";
import { fromDecimalString, fromMinor } from "@/lib/money/money";
import { useContacts } from "@/lib/contacts/contacts-context";
import { displayName, type Contact } from "@/lib/contacts/contacts";
import { AddContactSheet } from "@/components/contacts/add-contact-sheet";
import { useSend } from "@/lib/send/send-context";
import { useActivity, type ActivityEntry } from "@/lib/activity/activity";
import { useLimits } from "@/lib/limits/limits-context";
import { MAX_LEVEL } from "@/lib/limits/limits";
import { FLAGS } from "@/lib/flags";
import { formatDayAndTime } from "@/lib/datetime";
import { truncateAddress } from "@/lib/format";
import { useUsername } from "@/lib/settings/use-username";
import { emailName } from "@/lib/settings/username";
import { NameSheet } from "@/components/settings/name-sheet";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;
  const { displayName: ownName, username, email, setUsername } = useUsername();
  const [editingName, setEditingName] = useState(false);

  const { balance, loading: balanceLoading } = useUsdcBalance(address);
  const { format, formatParts } = useMoney();
  const usdBalance = balance ? fromDecimalString(balance, "USD") : fromMinor(0n, "USD");
  const { money: localBalance, loading: rateLoading } = useConverted(usdBalance);

  const { entries } = useActivity(address);
  const { contacts } = useContacts();
  const { limits } = useLimits();
  const { setContactId } = useSend();
  const [addingContact, setAddingContact] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const sendToContact = (contact: Contact) => {
    setContactId(contact.id);
    router.push("/send/amount");
  };

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  useEffect(() => {
    if (ready && !authenticated) router.replace("/onboarding");
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  const { symbol, integer, decimal, fraction } = formatParts(localBalance ?? usdBalance);
  const pending = balanceLoading || rateLoading;

  return (
    <Screen
      footer={
        <Button variant="black" onClick={() => router.push("/send")}>
          {t("home.sendMoney")}
        </Button>
      }
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1">
          {/* The name is only a label; tapping always copies the full address, which is what people paste elsewhere. */}
          <button
            onClick={copyAddress}
            disabled={!address}
            aria-label={address ? t("home.copyAddress") : undefined}
            className="min-w-0 max-w-full active:opacity-70"
          >
            <Badge className="max-w-full gap-2 py-1.5 pl-1.5 pr-3">
              <span className="h-5 w-5 shrink-0 rounded-full bg-primary" />
              <span className="flex min-w-0 flex-col items-start text-left leading-tight">
                {/* A chosen name or the email takes the label's place; without one, say what the address is. */}
                {ownName ? (
                  <span className="max-w-full truncate">{ownName}</span>
                ) : (
                  <span className="text-xs">{t("tabs.home.address")}:</span>
                )}
                <span style={ownName ? typography.label5 : undefined} className={clsx("max-w-full truncate", ownName && "text-text-secondary")}>
                  {addressCopied
                    ? t("common.copied")
                    : address
                      ? truncateAddress(address)
                      : t("tabs.home.greeting")}
                </span>
              </span>
              {address &&
                (addressCopied ? (
                  <Check size={14} className="shrink-0 text-primary" aria-hidden />
                ) : (
                  <Copy size={14} className="shrink-0 text-text-secondary" aria-hidden />
                ))}
            </Badge>
          </button>
          {/* Passkey sign-ups have no email to borrow a name from, so invite them to set one here. */}
          {!ownName && address && (
            <button onClick={() => setEditingName(true)} style={typography.label5} className="pl-1 text-primary active:opacity-70">
              {t("home.addName")}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <button onClick={() => router.push("/pay")}>
            <Badge variant="dark">{t("home.scanQr")}</Badge>
          </button>
          <button onClick={() => router.push("/help")}>
            <Badge variant="outline">{t("tabs.help")}</Badge>
          </button>
          <button
            onClick={() => router.push("/settings")}
            aria-label={t("settings")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-light bg-white text-text-secondary active:opacity-70"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      <NameSheet
        open={editingName}
        onClose={() => setEditingName(false)}
        current={username}
        placeholder={emailName(email) ?? t("settings.usernamePlaceholder")}
        onSave={setUsername}
      />

      <Carousel className="mt-6">
        {[
          <StatusCard
            key="balance"
            label={t("home.balance.label")}
            caption={t("home.balance.caption")}
            footer={t("home.balance.footer")}
            backgroundImage="/RumaBalanceCardBg.png"
            className="min-h-44"
          >
            <p style={typography.display1} className={clsx(pending && "opacity-60")}>
              <small className="text-2xl opacity-60">{symbol}</small>
              {integer}
              <small className="text-2xl opacity-60">
                {decimal}
                {fraction}
              </small>
            </p>
          </StatusCard>,
          // Until an issuer is connected the card face stays in the carousel as a
          // promise, but with nothing to tap and no number to show.
          FLAGS.card ? (
            <button key="card" onClick={() => router.push("/card")} className="block w-full text-left">
              <PaymentCard last4="4417" kind={t("home.card.debit")} className="min-h-50.25" />
            </button>
          ) : (
            <PaymentCard key="card" kind={t("home.card.debit")} note={t("card.soon")} className="min-h-50.25" />
          ),
        ]}
      </Carousel>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => router.push("/add-money")}>
          {t("home.addMoney")}
        </Button>
        <Button variant="secondary" onClick={() => router.push("/withdraw")}>
          {t("home.withdrawMoney")}
        </Button>
      </div>

      <SectionTitle className="mt-8">{t("home.sendTo")}</SectionTitle>
      <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ContactButton label={t("home.sendTo.new")} onClick={() => setAddingContact(true)}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border-light text-text-secondary">
            <Plus size={18} />
          </span>
        </ContactButton>
        {contacts.map((contact) => (
          <ContactButton
            key={contact.id}
            label={displayName(contact)}
            onClick={() => sendToContact(contact)}
          >
            {/* Initials come from the first word of the name, so "Rosa Cedeño" is R, not RC. */}
            <Avatar name={displayName(contact)} />
          </ContactButton>
        ))}
      </div>

      <AddContactSheet open={addingContact} onClose={() => setAddingContact(false)} />

      <button onClick={() => router.push("/limits")} className="mt-6 block w-full text-left">
        <Card className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p style={typography.heading4}>
              {t("home.limit.title", { amount: format(limits.perSend) })}
            </p>
            <p style={typography.body4} className="mt-0.5 text-text-secondary">
              {t("home.limit.subtitle", { level: limits.level, total: MAX_LEVEL })}
            </p>
          </div>
          <Badge variant="dark">{t("home.limit.action")}</Badge>
        </Card>
      </button>

      <SectionTitle className="mt-8">{t("home.activity.title")}</SectionTitle>
      {entries && entries.length > 0 ? (
        <Card divided>
          {entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </Card>
      ) : (
        <p style={typography.body3} className="text-text-secondary">
          {entries ? t("home.activity.empty") : t("common.loading")}
        </p>
      )}
    </Screen>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 style={typography.heading3} className={clsx("mb-3", className)}>
      {children}
    </h2>
  );
}

function ContactButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:opacity-70">
      {children}
      <span style={typography.body5} className="w-full truncate text-center text-text-tertiary">
        {label}
      </span>
    </button>
  );
}

const ACTIVITY_ICONS = {
  sent: ArrowUpRight,
  received: ArrowDownLeft,
  paid: Store,
} as const;

/** Alchemy reports a raw address; show the contact's name when we know them. */
function counterpartyLabel(entry: ActivityEntry, contacts: ReturnType<typeof useContacts>["contacts"]) {
  if (!entry.counterparty.startsWith("0x")) return entry.counterparty;
  const known = contacts.find(
    (contact) =>
      contact.payout.kind === "ruma" &&
      contact.payout.reference.toLowerCase() === entry.counterparty.toLowerCase()
  );
  return known ? displayName(known) : truncateAddress(entry.counterparty);
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { contacts } = useContacts();
  const Icon = ACTIVITY_ICONS[entry.kind];
  const outgoing = entry.amount.amount < 0n;

  return (
    <ListRow
      leading={
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
          <Icon size={16} />
        </span>
      }
      title={t(`home.activity.${entry.kind}`, { name: counterpartyLabel(entry, contacts) })}
      subtitle={`${t(`home.activity.status.${entry.status}`)} · ${formatDayAndTime(entry.occurredAt, language)}`}
      trailing={
        <span
          style={{ ...typography.label2, fontWeight: 700 }}
          className={clsx("shrink-0", outgoing ? "text-text" : "text-success")}
        >
          {outgoing ? "" : "+"}
          {format(entry.amount)}
        </span>
      }
    />
  );
}
