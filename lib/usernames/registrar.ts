import { isAddress, isAddressEqual, parseAbi, toCoinType, type Address } from "viem";
import { normalize } from "viem/ens";
import { base } from "viem/chains";

import { fullEnsName } from "./handle";

/** RumaRegistrar on Ethereum mainnet (contracts/RumaRegistrar.sol). Unset until it is deployed. */
const rawRegistrar = process.env.NEXT_PUBLIC_RUMA_REGISTRAR_ADDRESS?.trim();
export const RUMA_REGISTRAR_ADDRESS: Address | null = rawRegistrar && isAddress(rawRegistrar) ? rawRegistrar : null;

/** Without a registrar there is nothing to claim or look up, so the username screens stay hidden. */
export const USERNAMES_ENABLED = RUMA_REGISTRAR_ADDRESS !== null;

/** Ruma balances live on Base, so that is the address record that has to match. */
export const BASE_COIN_TYPE = toCoinType(base.id);

export const rumaRegistrarAbi = parseAbi([
  "function claim(string label, address account)",
  "function isAvailable(string label) view returns (bool)",
  "function labelOf(address account) view returns (string)",
  "error Unauthorized()",
  "error ZeroAddress()",
  "error InvalidLabel(string label)",
  "error AlreadyHasName(address account)",
  "error LabelUsed(string label)",
  // Raised by the UserRegistry; claim passes them through unchanged.
  "error LabelAlreadyRegistered(string label)",
  "error LabelAlreadyReserved(string label)",
]);

/** The chain reads usernames need, behind an interface so the logic is testable without an RPC. */
export interface UsernameReader {
  /** The label the registrar issued to `address`, or "" if none. */
  labelOf(address: Address): Promise<string>;
  isAvailable(label: string): Promise<boolean>;
  /** What a full ENS name resolves to on Base, through the Universal Resolver. */
  resolve(name: string): Promise<Address | null>;
}

interface ChainClient {
  readContract(args: {
    address: Address;
    abi: typeof rumaRegistrarAbi;
    functionName: "labelOf" | "isAvailable";
    args: readonly [Address] | readonly [string];
  }): Promise<unknown>;
  getEnsAddress(args: { name: string; coinType?: bigint }): Promise<Address | null>;
}

export function chainReader(client: ChainClient, registrar: Address): UsernameReader {
  return {
    labelOf: async (address) =>
      (await client.readContract({ address: registrar, abi: rumaRegistrarAbi, functionName: "labelOf", args: [address] })) as string,
    isAvailable: async (label) =>
      (await client.readContract({ address: registrar, abi: rumaRegistrarAbi, functionName: "isAvailable", args: [label] })) as boolean,
    resolve: (name) => client.getEnsAddress({ name: normalize(name), coinType: BASE_COIN_TYPE }),
  };
}

/**
 * The username of `address`, or null if it has none. The registrar's record
 * is only trusted once the name also resolves back to this address, so a
 * resolver change made outside the registrar can't show a stale name.
 */
export async function lookupHandle(reader: UsernameReader, address: Address): Promise<string | null> {
  const label = await reader.labelOf(address);
  if (!label) return null;
  const resolved = await reader.resolve(fullEnsName(label));
  return resolved && isAddressEqual(resolved, address) ? label : null;
}

/** The Base address behind a username, or null if nobody has it. */
export function resolveHandle(reader: UsernameReader, label: string): Promise<Address | null> {
  return reader.resolve(fullEnsName(label));
}
