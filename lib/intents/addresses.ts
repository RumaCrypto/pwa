import { isAddress } from "viem";
import { bech32, bech32m, createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";
import type { NetworkId } from "./networks";

/**
 * Withdrawals send real money to whatever the user types, so a format check is
 * not enough: every address here is verified against its checksum, which
 * catches a mistyped or truncated paste before it becomes unrecoverable.
 */
const base58check = createBase58check(sha256);

function base58Payload(address: string): Uint8Array | null {
  try {
    return base58check.decode(address);
  } catch {
    return null;
  }
}

function isEvmAddress(address: string): boolean {
  // strict: mixed case must match its EIP-55 checksum; all-lowercase has none to check.
  return isAddress(address, { strict: true });
}

function isTronAddress(address: string): boolean {
  const payload = base58Payload(address);
  return payload !== null && payload.length === 21 && payload[0] === 0x41;
}

function isBitcoinBase58(address: string): boolean {
  const payload = base58Payload(address);
  // 0x00 = P2PKH, 0x05 = P2SH on mainnet; testnet versions are refused.
  return payload !== null && payload.length === 21 && (payload[0] === 0x00 || payload[0] === 0x05);
}

function isBitcoinSegwit(address: string): boolean {
  // Bech32 forbids mixed case; wallets show either all-lower or all-upper.
  const lower = address.toLowerCase();
  if (address !== lower && address !== address.toUpperCase()) return false;
  if (!lower.startsWith("bc1")) return false;

  // The witness version is the first data character: "q" is v0, which uses
  // bech32; any later version uses bech32m (BIP-350).
  const isV0 = lower[3] === "q";
  const coder = isV0 ? bech32 : bech32m;
  try {
    const { prefix, words } = coder.decode(lower as `${string}1${string}`, 90);
    if (prefix !== "bc" || words.length === 0) return false;
    const [version, ...data] = words;
    const program = coder.fromWords(data);
    if (isV0) return version === 0 && (program.length === 20 || program.length === 32);
    // Only Taproot (v1, 32 bytes) is defined beyond v0; later versions are unspendable today.
    return version === 1 && program.length === 32;
  } catch {
    return false;
  }
}

const NEAR_IMPLICIT = /^[0-9a-f]{64}$/;
// NEAR's account id rules: 2-64 chars, lowercase parts split by ".", "-" or "_" inside a part.
const NEAR_NAMED = /^(?=.{2,64}$)([a-z\d]+[-_])*[a-z\d]+(\.([a-z\d]+[-_])*[a-z\d]+)*$/;

export function isImplicitNearAccount(address: string): boolean {
  return NEAR_IMPLICIT.test(address);
}

/** Named accounts only exist once registered, so the server checks them on-chain before quoting. */
export function isNamedNearAccount(address: string): boolean {
  return !NEAR_IMPLICIT.test(address) && NEAR_NAMED.test(address);
}

const VALIDATORS: Record<NetworkId, (address: string) => boolean> = {
  eth: isEvmAddress,
  arb: isEvmAddress,
  op: isEvmAddress,
  tron: isTronAddress,
  btc: (a) => isBitcoinBase58(a) || isBitcoinSegwit(a),
  near: (a) => NEAR_IMPLICIT.test(a) || NEAR_NAMED.test(a),
};

export function isValidNetworkAddress(network: NetworkId, address: string): boolean {
  return VALIDATORS[network](address.trim());
}
