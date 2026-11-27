"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  http,
  isAddressEqual,
  parseAbi,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";

import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";
import { USDC_ADDRESS_BASE } from "@/lib/usdc";
import { FLAGS } from "@/lib/flags";
import { describeError } from "@/lib/errors/describe-error";
import { sponsoredTransport } from "@/hooks/use-p2p-wallet-client";

interface Network {
  chain: Chain;
  usdc: Address;
  explorer: string;
  rpc?: string;
}

const NETWORKS: Record<"base" | "baseSepolia", Network> = {
  base: {
    chain: DEFAULT_SETTLEMENT_NETWORK,
    usdc: USDC_ADDRESS_BASE,
    explorer: "https://basescan.org/tx/",
    rpc: process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined,
  },
  baseSepolia: {
    chain: baseSepolia,
    // Circle's official test USDC on Base Sepolia.
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorer: "https://sepolia.basescan.org/tx/",
  },
};
const transferAbi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
/** EIP-7702 delegated accounts carry `0xef0100 || delegate` as their code. */
const DELEGATION_PREFIX = "0xef0100";

interface WalletState {
  eth: bigint;
  code: Hex | undefined;
}

interface TestResult {
  status: "running" | "ok" | "error";
  lines: string[];
}

export function GasSponsorshipDiagnostics() {
  const { ready, authenticated, user, login } = usePrivy();
  const address = user?.wallet?.address as Address | undefined;
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  const [networkKey, setNetworkKey] = useState<keyof typeof NETWORKS>("baseSepolia");
  const network = NETWORKS[networkKey];

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.chain, transport: http(network.rpc) }),
    [network],
  );

  /** Same wallet client the app builds, but on the selected network and always sponsored. */
  const getSponsoredClient = useCallback(async () => {
    if (!address) throw new Error("No wallet connected");
    const wallet = wallets.find((candidate) => candidate.address === address) ?? wallets[0];
    if (!wallet) throw new Error("No wallet connected");
    await wallet.switchChain(network.chain.id);
    const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;
    const walletClient = createWalletClient({
      account: address,
      chain: network.chain,
      transport: sponsoredTransport({ provider, sendTransaction, address, chainId: network.chain.id }),
    });
    return { walletClient, address };
  }, [address, wallets, network, sendTransaction]);

  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const refresh = useCallback(async () => {
    if (!address) return;
    const [eth, code] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.getCode({ address }),
    ]);
    setWallet({ eth, code });
  }, [address, publicClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Reads back the receipt and reports who paid and who the contract saw. */
  const inspect = useCallback(
    async (hash: Hex, ethBefore: bigint): Promise<string[]> => {
      if (!address) return [];
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const tx = await publicClient.getTransaction({ hash });
      const ethAfter = await publicClient.getBalance({ address });
      const lines = [
        `hash: ${network.explorer}${hash}`,
        `status: ${receipt.status}, tx type: ${tx.type}`,
        `tx.from (tx.origin): ${tx.from} ${isAddressEqual(tx.from, address) ? "= usuario" : "≠ usuario (bundler/relayer)"}`,
        `tx.to: ${tx.to}`,
        `ETH usuario: ${formatEther(ethBefore)} → ${formatEther(ethAfter)} (${ethAfter < ethBefore ? "PAGÓ EL USUARIO" : "no pagó el usuario"})`,
      ];
      for (const log of receipt.logs) {
        if (!isAddressEqual(log.address, network.usdc)) continue;
        try {
          const event = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics });
          if (event.eventName === "Transfer") {
            lines.push(
              `USDC Transfer.from (msg.sender en USDC): ${event.args.from} ${isAddressEqual(event.args.from, address) ? "= usuario ✓" : "≠ usuario ✗"}`,
            );
          }
        } catch {
          // not a Transfer log
        }
      }
      await refresh();
      return lines;
    },
    [address, network, publicClient, refresh],
  );

  const run = useCallback(
    async (id: string, fn: (ethBefore: bigint) => Promise<Hex>) => {
      if (!address) return;
      setResults((r) => ({ ...r, [id]: { status: "running", lines: ["enviando…"] } }));
      try {
        const ethBefore = await publicClient.getBalance({ address });
        const hash = await fn(ethBefore);
        setResults((r) => ({ ...r, [id]: { status: "running", lines: [`hash: ${hash}`, "esperando recibo…"] } }));
        const lines = await inspect(hash, ethBefore);
        setResults((r) => ({ ...r, [id]: { status: "ok", lines } }));
      } catch (error) {
        console.error(`[gas-sponsorship] test ${id} failed`, error);
        setResults((r) => ({ ...r, [id]: { status: "error", lines: [describeError(error)] } }));
      }
    },
    [address, inspect, publicClient],
  );

  /** A: Privy hook directly, 0 ETH to self. Isolates the dashboard/TEE config. */
  const testA = () =>
    run("A", async () => {
      const { hash } = await sendTransaction(
        { to: address, value: 0, chainId: network.chain.id },
        { sponsor: true, address },
      );
      return hash;
    });

  /** B: 0 USDC to self through the viem wallet client, the same path the p2p SDK uses. */
  const testB = () =>
    run("B", async () => {
      const { walletClient, address: from } = await getSponsoredClient();
      return walletClient.sendTransaction({
        account: from,
        // Privy's provider can keep reporting Base after switchChain; the sponsored
        // transport sends the chainId explicitly, so skip viem's chain assertion.
        chain: null,
        to: network.usdc,
        data: encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [from, BigInt(0)] }),
        value: BigInt(0),
      });
    });

  if (!ready) return <Shell>Cargando Privy…</Shell>;
  if (!authenticated || !address) {
    return (
      <Shell>
        <p>Inicia sesión con la cuenta de prueba.</p>
        <button className="mt-3 rounded bg-black px-4 py-2 text-white" onClick={login}>
          Iniciar sesión
        </button>
      </Shell>
    );
  }

  const delegated = wallet?.code?.toLowerCase().startsWith(DELEGATION_PREFIX);

  return (
    <Shell>
      <section className="space-y-1 text-sm">
        <Row label="Wallet">{address}</Row>
        <Row label="Wallet type">{user?.wallet?.walletClientType ?? "?"}</Row>
        <Row label="Red">
          <select
            className="border border-gray-300 bg-transparent"
            value={networkKey}
            onChange={(event) => {
              setResults({});
              setNetworkKey(event.target.value as keyof typeof NETWORKS);
            }}
          >
            {Object.entries(NETWORKS).map(([key, n]) => (
              <option key={key} value={key}>
                {`${n.chain.name} (${n.chain.id})`}
              </option>
            ))}
          </select>
        </Row>
        <Row label="ETH">{wallet ? formatEther(wallet.eth) : "…"}</Row>
        <Row label="Código (7702)">
          {wallet
            ? delegated
              ? `delegada → 0x${wallet.code!.slice(8)}`
              : wallet.code && wallet.code !== "0x"
                ? `contrato: ${wallet.code.slice(0, 20)}…`
                : "EOA sin delegación"
            : "…"}
        </Row>
        <Row label="Flag app">{`NEXT_PUBLIC_FEATURE_GAS_SPONSORSHIP=${FLAGS.gasSponsorship}`}</Row>
        <Row label="Diamond">{process.env.NEXT_PUBLIC_DIAMOND_ADDRESS || "⚠️ no configurado"}</Row>
      </section>

      <p className="mt-4 text-xs text-gray-600">
        Ambas pruebas son transacciones reales en la red elegida que no mueven fondos (0 ETH / 0 USDC a ti mismo). El gas
        lo cubre el patrocinio de Privy, si funciona.
      </p>

      <Test
        title="A · Privy directo: 0 ETH a mí mismo"
        hint="Aísla la configuración del dashboard (TEE, Base habilitada, patrocinio desde cliente, créditos)."
        onRun={testA}
        result={results.A}
      />
      <Test
        title="B · viem → transport patrocinado: 0 USDC a mí mismo"
        hint="Mismo camino que usa el SDK de p2p. Confirma msg.sender = usuario en el evento Transfer."
        onRun={testB}
        result={results.B}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl p-6 font-mono text-sm">
      <h1 className="mb-4 text-lg font-bold">Diagnóstico de gas sponsorship (#33)</h1>
      {children}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      <span className="break-all">{children}</span>
    </div>
  );
}

function Test({
  title,
  hint,
  onRun,
  result,
}: {
  title: string;
  hint: string;
  onRun: () => void;
  result?: TestResult;
}) {
  return (
    <section className="mt-5 rounded border border-gray-300 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <button
          className="shrink-0 rounded bg-black px-3 py-1 text-white disabled:opacity-40"
          onClick={onRun}
          disabled={result?.status === "running"}
        >
          {result?.status === "running" ? "…" : "Ejecutar"}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-600">{hint}</p>
      {result && (
        <pre
          className={`mt-2 whitespace-pre-wrap break-all text-xs ${result.status === "error" ? "text-red-600" : ""}`}
        >
          {result.lines.join("\n")}
        </pre>
      )}
    </section>
  );
}
