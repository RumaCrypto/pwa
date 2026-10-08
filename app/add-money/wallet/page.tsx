"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { NetworkLogo, NetworkLogoStack } from "@/components/ui/network-logos";
import { ReceiveAddress } from "@/components/cashflow/receive-address";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { FLAGS } from "@/lib/flags";
import { BASE_NETWORK, NETWORKS } from "@/lib/intents/networks";

type Source = "base" | "networks";

export default function AddFromWalletScreen() {
  // Without Aurora there is only one way in, so skip straight to it.
  if (!FLAGS.multichainDeposits) return <ReceiveAddress />;
  return <SourcePicker />;
}

function SourcePicker() {
  const router = useRouter();
  const { t } = useI18n();
  const [source, setSource] = useState<Source>("base");

  return (
    <Screen
      title={t("cashflow.wallet.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="black" onClick={() => router.push(`/add-money/wallet/${source}`)}>
          {t("cashflow.continue")}
        </Button>
      }
    >
      <h2 style={typography.display3} className="mb-6">
        {t("cashflow.wallet.question")}
      </h2>

      <div role="radiogroup" className="flex flex-col gap-3">
        <RadioCard
          title={t("cashflow.wallet.base")}
          description={t("cashflow.wallet.baseHint")}
          leading={<NetworkLogo network={BASE_NETWORK} size={24} />}
          selected={source === "base"}
          onSelect={() => setSource("base")}
        />
        <RadioCard
          title={t("cashflow.wallet.other")}
          description={t("cashflow.wallet.otherHint")}
          leading={<NetworkLogoStack networks={NETWORKS} />}
          selected={source === "networks"}
          onSelect={() => setSource("networks")}
        />
      </div>
    </Screen>
  );
}
