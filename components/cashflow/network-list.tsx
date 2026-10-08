"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { NetworkLogo } from "@/components/ui/network-logos";
import { NETWORKS, type Network } from "@/lib/intents/networks";

/** Each network with its official logo from public/networks; shared by deposits and withdrawals. */
export function NetworkList({ hrefFor }: { hrefFor: (network: Network) => string }) {
  const router = useRouter();
  return (
    <Card className="divide-y divide-border-light overflow-hidden">
      {NETWORKS.map((network) => (
        <ListRow
          key={network.id}
          leading={<NetworkLogo network={network} />}
          title={network.name}
          chevron
          onClick={() => router.push(hrefFor(network))}
        />
      ))}
    </Card>
  );
}
