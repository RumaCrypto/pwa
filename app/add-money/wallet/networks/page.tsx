"use client";

import { notFound, useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { NetworkLogo } from "@/components/ui/network-logos";
import { typography } from "@/constants/typography";

import { FLAGS } from "@/lib/flags";
import { useI18n } from "@/lib/i18n/i18n-context";
import { NETWORKS } from "@/lib/intents/networks";

export default function NetworkPickerPage() {
  // Checked in a wrapper because notFound() throws and the screen below has hooks.
  if (!FLAGS.multichainDeposits) notFound();
  return <NetworkPickerScreen />;
}

function NetworkPickerScreen() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <Screen title={t("intents.networks.title")} backLabel={t("common.back")}>
      <h2 style={typography.display3} className="mb-6">
        {t("intents.networks.question")}
      </h2>

      <Card className="divide-y divide-border-light overflow-hidden">
        {NETWORKS.map((network) => (
          <ListRow
            key={network.id}
            leading={<NetworkLogo network={network} />}
            title={network.name}
            chevron
            onClick={() => router.push(`/add-money/wallet/networks/${network.id}`)}
          />
        ))}
      </Card>
    </Screen>
  );
}
