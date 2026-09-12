"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Snowflake, Eye, Apple } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card as Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ListRow } from "@/components/ui/list-row";
import { DetailRow } from "@/components/ui/detail-row";
import { PaymentCard } from "@/components/ui/payment-card";
import { typography } from "@/constants/typography";

import { usePrivy } from "@privy-io/react-auth";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useConverted, useMoney } from "@/lib/money/money-context";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { fromDecimalString, fromMinor } from "@/lib/money/money";
import { useCard } from "@/lib/card/card-context";
import { SETUP_STEPS, formatExpiry, nextSetupStep, type SetupStep } from "@/lib/card/card";
import type { CardSecrets } from "@/lib/card/card-provider";

export default function CardScreen() {
  const { t } = useI18n();
  const { setup } = useCard();

  if (!setup) return null;

  return (
    <Screen title={t("card.title")} backLabel={t("common.back")}>
      {setup.card ? <ProvisionedCard /> : <CardSetupSteps />}
    </Screen>
  );
}

function CardSetupSteps() {
  const { t } = useI18n();
  const { setup, busy, startKyc, requestEndorsement, approveSpending, createCard } = useCard();
  if (!setup) return null;

  const pending = nextSetupStep(setup);

  const advance = () => {
    if (pending === "kyc") return startKyc();
    if (pending === "endorsement") return requestEndorsement();
    if (pending === "approval") return approveSpending();
    if (pending === "create") return createCard("virtual");
  };

  return (
    <>
      <h2 style={typography.display3}>{t("card.setup.title")}</h2>
      <p style={typography.body1} className="mt-2 text-text-secondary">
        {t("card.setup.subtitle")}
      </p>

      <Panel divided className="mt-6">
        {SETUP_STEPS.map((step, index) => {
          const done = SETUP_STEPS.indexOf(pending ?? "create") > index || pending === null;

          return (
            <ListRow
              key={step}
              leading={
                <span
                  style={typography.label3}
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    done ? "bg-primary text-white" : "bg-primary-light text-primary-dark"
                  )}
                >
                  {done ? <Check size={16} /> : index + 1}
                </span>
              }
              title={t(`card.setup.${step}` as "card.setup.kyc")}
              subtitle={t(`card.setup.${step}Hint` as "card.setup.kycHint")}
              trailing={done ? <Badge variant="outline">{t("card.setup.stepDone")}</Badge> : undefined}
            />
          );
        })}
      </Panel>

      <Button className="mt-6" onClick={advance} disabled={busy}>
        {busy ? t("card.setup.working") : t("card.setup.action")}
      </Button>
    </>
  );
}

function ProvisionedCard() {
  const { t } = useI18n();
  const { format } = useMoney();
  const { setup, controls, busy, setStatus, updateControls, revealDetails } = useCard();

  const { user } = usePrivy();
  const { balance } = useUsdcBalance(user?.wallet?.address);
  const usdBalance = balance ? fromDecimalString(balance, "USD") : fromMinor(0n, "USD");
  const { money: displayBalance } = useConverted(usdBalance);

  const [secrets, setSecrets] = useState<CardSecrets | null>(null);
  const [revealing, setRevealing] = useState(false);

  const card = setup?.card;
  if (!card || !controls) return null;

  const frozen = card.status === "frozen";

  const handleReveal = async () => {
    setRevealing(true);
    try {
      setSecrets(await revealDetails());
    } finally {
      setRevealing(false);
    }
  };

  return (
    <>
      <PaymentCard
        last4={card.last4}
        holder={card.holder}
        kind={t("card.debit")}
        expiry={`${t("card.expires")} ${formatExpiry(card)} · CVV ···`}
        className={clsx(frozen && "opacity-50")}
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <PillButton onClick={() => setStatus(frozen ? "active" : "frozen")} disabled={busy}>
          <Snowflake size={15} />
          {frozen ? t("card.unfreeze") : t("card.freeze")}
        </PillButton>
        <PillButton onClick={handleReveal} disabled={revealing}>
          <Eye size={15} />
          {t("card.viewDetails")}
        </PillButton>
        <PillButton disabled>
          <Apple size={15} />
          {t("card.applePay")}
        </PillButton>
      </div>

      {frozen && (
        <p style={typography.body4} className="mt-3 text-center text-danger">
          {t("card.frozen")}
        </p>
      )}

      <Panel className="mt-6 px-5 py-5">
        <p style={typography.body3} className="text-text-tertiary">
          {t("card.available")}
        </p>
        {/* The spendable figure is the wallet balance, not the monthly ceiling —
            the card draws on the same funds the send flow does. */}
        <p style={typography.display4} className="mt-1">
          {format(displayBalance ?? usdBalance)}
        </p>
        <p style={typography.body4} className="mt-2 text-text-secondary">
          {t("card.availableHint")}
        </p>
      </Panel>

      <h3 style={typography.heading3} className="mb-3 mt-8">
        {t("card.settings")}
      </h3>

      <Panel divided>
        <ListRow
          title={t("card.monthlyLimit")}
          subtitle={t("card.monthlyLimitHint")}
          trailing={<Badge>{format(controls.monthlyLimit)}</Badge>}
        />
        <ListRow
          title={t("card.perPurchase")}
          subtitle={t("card.perPurchaseHint")}
          trailing={<Badge>{format(controls.perPurchaseLimit)}</Badge>}
        />
        <ListRow
          title={t("card.onlinePurchases")}
          subtitle={controls.onlinePurchases ? t("card.on") : t("card.off")}
          trailing={
            <Badge variant={controls.onlinePurchases ? "light" : "outline"}>
              {controls.onlinePurchases ? t("card.yes") : t("card.no")}
            </Badge>
          }
          onClick={() => updateControls({ onlinePurchases: !controls.onlinePurchases })}
        />
      </Panel>

      <Sheet
        open={secrets !== null}
        onClose={() => setSecrets(null)}
        title={t("card.details.title")}
        closeLabel={t("card.details.close")}
      >
        <Panel className="px-5 py-3">
          <DetailRow
            label={t("card.details.number")}
            value={<span className="font-mono">{secrets?.pan}</span>}
          />
          <DetailRow label={t("card.details.cvv")} value={<span className="font-mono">{secrets?.cvv}</span>} />
          <DetailRow
            label={t("card.details.expiry")}
            value={<span className="font-mono">{secrets?.expiry}</span>}
          />
        </Panel>
        <p style={typography.body4} className="mt-4 text-text-secondary">
          {t("card.details.warning")}
        </p>
      </Sheet>
    </>
  );
}

function PillButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={typography.label4}
      className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-border-light bg-white active:bg-card disabled:opacity-40"
    >
      {children}
    </button>
  );
}
