"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { NetworkLogo, NetworkLogoStack } from "@/components/ui/network-logos";
import { SendToWallet } from "@/components/cashflow/send-to-wallet";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { FLAGS } from "@/lib/flags";
import { BASE_NETWORK, NETWORKS } from "@/lib/intents/networks";

type Destination = "base" | "networks";

/** Display order the designs ask for on the "other networks" option. */
const STACK_ORDER = ["tron", "btc", "eth", "op", "arb", "near"] as const;
const STACK = STACK_ORDER.map((id) => NETWORKS.find((n) => n.id === id)!);

export default function WithdrawToWalletScreen() {
  // Without Aurora there is only one way out, so skip straight to it.
  if (!FLAGS.multichainDeposits) return <SendToWallet />;
  return <DestinationPicker />;
}

function DestinationPicker() {
  const router = useRouter();
  const { t } = useI18n();
  const [destination, setDestination] = useState<Destination>("base");

  return (
    <Screen
      title={t("cashflow.withdrawWallet.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="black" onClick={() => router.push(`/withdraw/wallet/${destination}`)}>
          {t("cashflow.continue")}
        </Button>
      }
    >
      <h2 style={typography.display3} className="mb-6">
        {t("cashflow.withdrawWallet.question")}
      </h2>

      <div role="radiogroup" className="flex flex-col gap-3">
        <RadioCard
          title={t("cashflow.withdrawWallet.base")}
          description={t("cashflow.withdrawWallet.baseHint")}
          leading={<NetworkLogo network={BASE_NETWORK} size={24} />}
          selected={destination === "base"}
          onSelect={() => setDestination("base")}
        />
        <RadioCard
          title={t("cashflow.withdrawWallet.other")}
          description={t("cashflow.withdrawWallet.otherHint")}
          leading={<NetworkLogoStack networks={STACK} />}
          selected={destination === "networks"}
          onSelect={() => setDestination("networks")}
        />
      </div>
    </Screen>
  );
}
