"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ListRow } from "@/components/ui/list-row";
import { DetailRow } from "@/components/ui/detail-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useMoney } from "@/lib/money/money-context";
import { useLimits } from "@/lib/limits/limits-context";
import {
  MAX_LEVEL,
  SENDS_FOR_TOP_LEVEL,
  SOCIAL_NETWORKS,
  rewardFor,
  type RaiseStep,
  type SocialNetwork,
} from "@/lib/limits/limits";

const STEPS: RaiseStep[] = ["social", "document", "usage"];

export default function LimitsScreen() {
  const { t } = useI18n();
  const { format } = useMoney();
  const { level, limits, verifications, connectSocial, verifyDocument } = useLimits();

  const [sheet, setSheet] = useState<"social" | "document" | null>(null);

  const isDone = (step: RaiseStep) =>
    step === "social"
      ? verifications.socials.length > 0
      : step === "document"
        ? verifications.document
        : verifications.completedSends >= SENDS_FOR_TOP_LEVEL;

  return (
    <Screen title={t("limits.title")} backLabel={t("common.back")}>
      <h2 style={typography.display3}>{t("limits.level", { level, total: MAX_LEVEL })}</h2>
      <ProgressBar value={level / MAX_LEVEL} className="mt-4" />

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("limits.perSend")} value={format(limits.perSend)} />
        <DetailRow label={t("limits.perDay")} value={format(limits.perDay)} />
        <DetailRow label={t("limits.sendsPerDay")} value={limits.sendsPerDay} />
      </Card>

      {/* Only true before anything has been verified; past that it contradicts the screen. */}
      {level === 1 && (
        <Callout className="mt-5" title={t("limits.noteTitle")}>
          {t("limits.noteBody")}
        </Callout>
      )}

      <h3 style={typography.heading3} className="mb-3 mt-8">
        {t("limits.raise")}
      </h3>

      <Card divided>
        {STEPS.map((step, index) => {
          const done = isDone(step);
          const reward = rewardFor(step);

          return (
            <ListRow
              key={step}
              leading={<StepNumber index={index + 1} done={done} />}
              title={t(`limits.step.${step}` as "limits.step.social")}
              subtitle={
                step === "usage" && !done
                  ? t("limits.usageProgress", {
                      done: verifications.completedSends,
                      total: SENDS_FOR_TOP_LEVEL,
                    })
                  : t(`limits.step.${step}Hint` as "limits.step.socialHint")
              }
              trailing={
                <Badge variant={done ? "outline" : "light"}>
                  {done
                    ? t("limits.step.done")
                    : reward
                      ? format(reward)
                      : t("limits.step.usageBadge")}
                </Badge>
              }
              onClick={
                done || step === "usage"
                  ? undefined
                  : () => setSheet(step === "social" ? "social" : "document")
              }
            />
          );
        })}
      </Card>

      {level === MAX_LEVEL && (
        <p style={typography.body3} className="mt-5 text-center text-text-secondary">
          {t("limits.topLevel")}
        </p>
      )}

      <SocialSheet
        open={sheet === "social"}
        onClose={() => setSheet(null)}
        connected={verifications.socials}
        onConnect={(network) => {
          connectSocial(network);
          setSheet(null);
        }}
      />

      <DocumentSheet
        open={sheet === "document"}
        onClose={() => setSheet(null)}
        onVerified={() => {
          verifyDocument();
          setSheet(null);
        }}
      />
    </Screen>
  );
}

function StepNumber({ index, done }: { index: number; done: boolean }) {
  return (
    <span
      style={typography.label3}
      className={clsx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        done ? "bg-primary text-white" : "bg-primary-light text-primary-dark"
      )}
    >
      {done ? <Check size={16} /> : index}
    </span>
  );
}

function SocialSheet({
  open,
  onClose,
  connected,
  onConnect,
}: {
  open: boolean;
  onClose: () => void;
  connected: readonly string[];
  onConnect: (network: SocialNetwork) => void;
}) {
  const { t } = useI18n();

  return (
    <Sheet open={open} onClose={onClose} title={t("limits.social.title")} closeLabel={t("common.cancel")}>
      <p style={typography.body3} className="mb-4 text-text-secondary">
        {t("limits.social.hint")}
      </p>
      <Card divided>
        {SOCIAL_NETWORKS.map((network) => {
          const already = connected.includes(network);
          return (
            <ListRow
              key={network}
              title={<span className="capitalize">{network}</span>}
              trailing={already ? <Badge variant="outline">{t("limits.social.connected")}</Badge> : undefined}
              chevron={!already}
              onClick={already ? undefined : () => onConnect(network)}
            />
          );
        })}
      </Card>
    </Sheet>
  );
}

function DocumentSheet({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { t } = useI18n();
  const [verifying, setVerifying] = useState(false);

  // Stands in for the identity provider's flow; only this handler changes when
  // a real one is wired up.
  const start = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      onVerified();
    }, 1800);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("limits.document.title")}
      closeLabel={t("common.cancel")}
      footer={
        <Button onClick={start} disabled={verifying}>
          {verifying ? t("limits.document.verifying") : t("limits.document.start")}
        </Button>
      }
    >
      <p style={typography.body3} className="text-text-secondary">
        {t("limits.document.hint")}
      </p>
    </Sheet>
  );
}
