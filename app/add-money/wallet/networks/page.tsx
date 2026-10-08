"use client";

import { notFound } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { NetworkList } from "@/components/cashflow/network-list";
import { typography } from "@/constants/typography";

import { FLAGS } from "@/lib/flags";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function NetworkPickerPage() {
  // Checked in a wrapper because notFound() throws and the screen below has hooks.
  if (!FLAGS.multichainDeposits) notFound();
  return <NetworkPickerScreen />;
}

function NetworkPickerScreen() {
  const { t } = useI18n();

  return (
    <Screen title={t("intents.networks.title")} backLabel={t("common.back")}>
      <h2 style={typography.display3} className="mb-6">
        {t("intents.networks.question")}
      </h2>

      <NetworkList hrefFor={(network) => `/add-money/wallet/networks/${network.id}`} />
    </Screen>
  );
}
