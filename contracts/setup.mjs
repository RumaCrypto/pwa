#!/usr/bin/env node
/**
 * One-time on-chain setup for usernames under rumalatam.eth (ENSv2, Ethereum mainnet).
 *
 *   OWNER_ADDRESS=0x… CLAIMER_ADDRESS=0x… node contracts/setup.mjs              # dry run: checks and prints the plan
 *   OWNER_PRIVATE_KEY=0x… CLAIMER_ADDRESS=0x… node contracts/setup.mjs --send   # sends the transactions
 *
 * OWNER_PRIVATE_KEY is the wallet that owns rumalatam.eth. Pass it inline for this
 * one run; never put it in the app's .env. CLAIMER_ADDRESS is the writer wallet
 * (the address of ENS_WRITER_PRIVATE_KEY). MAINNET_RPC_URL is optional.
 *
 * Safe to re-run: every step checks the chain first and skips what is done.
 * See contracts/README.md for what each step means.
 */
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  isAddress,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseEventLogs,
  toHex,
  concat,
  stringToBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const PARENT_LABEL = "rumalatam";

// ENSv2 mainnet deployment (docs.ens.domains/learn/deployments).
const ETH_REGISTRY = "0xf60aba43e1f7f3dab1186ff03b561401c9df85e2";
const VERIFIABLE_FACTORY = "0x77510ba162dfea3d8989e3f0928a691b345730d2";
const USER_REGISTRY_IMPL = "0xfaa23592aca10a6d8875b18ea86954e8eb6d8d72";
const PERMISSIONED_RESOLVER_IMPL = "0x565b0f456a04ac9b48758190e90030623cff57c5";

// Fixed salts make the proxy addresses predictable, which is what lets re-runs skip finished steps.
const REGISTRY_SALT = BigInt(keccak256(toHex("ruma:usernames:registry:v1")));
const RESOLVER_SALT = BigInt(keccak256(toHex("ruma:usernames:resolver:v1")));

const admin = (role) => role | (role << 128n);
// RegistryRolesLib (as deployed). The owner gets every root role plus its admin role.
const REG = {
  REGISTRAR: 1n << 0n,
  REGISTER_RESERVED: 1n << 4n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  SET_URI: 1n << 36n,
  UPGRADE: 1n << 124n,
};
const REGISTRY_OWNER_ROLES = Object.values(REG).reduce((all, role) => all | admin(role), 0n);
// PermissionedResolverLib (as deployed).
const RES = {
  SET_ADDRESS: 1n << 0n,
  SET_TEXT: 1n << 4n,
  SET_CONTENTHASH: 1n << 8n,
  SET_ABI: 1n << 12n,
  SET_INTERFACE: 1n << 16n,
  SET_NAME: 1n << 20n,
  SET_DATA: 1n << 24n,
  LINK: 1n << 28n,
  UPGRADE: 1n << 124n,
};
const RESOLVER_OWNER_ROLES = Object.values(RES).reduce((all, role) => all | admin(role), 0n);

const factoryAbi = parseAbi([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address)",
  "function predictProxyAddress(address deployer, uint256 salt) view returns (address)",
  "event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)",
]);
const registryAbi = parseAbi([
  "struct Grant { address account; uint256 roleBitmap; }",
  "function initialize(Grant[] grants)",
  "function findOwner(string label) view returns (address)",
  "function getSubregistry(string label) view returns (address)",
  "function hasRoles(uint256 anyId, uint256 roleBitmap, address account) view returns (bool)",
  "function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
  "function grantRootRoles(uint256 roleBitmap, address account) returns (bool)",
  "function setParent(address parent, string label)",
  "function setSubregistry(uint256 anyId, address registry)",
  "function getExpiry(uint256 anyId) view returns (uint64)",
]);
const resolverAbi = parseAbi([
  "struct Grant { address account; uint256 roleBitmap; }",
  "function initialize(Grant[] grants, bytes[] calls)",
  "function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
  "function grantRootRoles(uint256 roleBitmap, address account) returns (bool)",
]);
const artifact = JSON.parse(readFileSync(new URL("./out/RumaRegistrar.json", import.meta.url), "utf8"));

/** DNS wire format: each label prefixed by its length, then a zero byte. */
function dnsEncode(name) {
  return toHex(concat([...name.split(".").flatMap((l) => [new Uint8Array([l.length]), stringToBytes(l)]), new Uint8Array([0])]));
}

const send = process.argv.includes("--send");
const ownerKey = process.env.OWNER_PRIVATE_KEY?.trim();
const ownerAddress = process.env.OWNER_ADDRESS?.trim();
const claimer = process.env.CLAIMER_ADDRESS?.trim();
// A dry run only needs the address, so the plan can be checked before the key leaves the wallet.
if (!ownerKey && (send || !ownerAddress || !isAddress(ownerAddress))) {
  throw new Error("Set OWNER_PRIVATE_KEY (the wallet that owns rumalatam.eth), or OWNER_ADDRESS for a dry run");
}
if (!claimer || !isAddress(claimer)) throw new Error("Set CLAIMER_ADDRESS (the writer wallet's address)");

const account = ownerKey ? privateKeyToAccount(ownerKey) : null;
const transport = http(process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com");
const pub = createPublicClient({ chain: mainnet, transport });
const wallet = account ? createWalletClient({ account, chain: mainnet, transport }) : null;
const owner = account?.address ?? ownerAddress;
const parentId = BigInt(keccak256(toHex(PARENT_LABEL)));

async function tx(description, request) {
  if (!send) return console.log(`  would send: ${description}`);
  console.log(`  sending: ${description}`);
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${description} reverted (${hash})`);
  console.log(`  done: ${hash}`);
  return receipt;
}

async function hasCode(address) {
  return ((await pub.getCode({ address })) ?? "0x") !== "0x";
}

async function deployProxy(name, implementation, salt, data) {
  const predicted = await pub.readContract({ address: VERIFIABLE_FACTORY, abi: factoryAbi, functionName: "predictProxyAddress", args: [owner, salt] });
  if (await hasCode(predicted)) {
    console.log(`  ${name} already deployed at ${predicted}`);
    return predicted;
  }
  await tx(`deploy ${name} proxy → ${predicted}`, {
    address: VERIFIABLE_FACTORY,
    abi: factoryAbi,
    functionName: "deployProxy",
    args: [implementation, salt, data],
  });
  return predicted;
}

console.log(send ? "Sending transactions." : "Dry run (add --send to broadcast).");
console.log(`owner ${owner}\nclaimer ${claimer}\n`);

console.log("0. Check ownership and expiry of rumalatam.eth");
const currentOwner = await pub.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: "findOwner", args: [PARENT_LABEL] });
if (!isAddressEqual(currentOwner, owner)) throw new Error(`rumalatam.eth is owned by ${currentOwner}, not ${owner}`);
const expiry = await pub.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: "getExpiry", args: [parentId] });
const years = (Number(expiry) * 1000 - Date.now()) / (365.25 * 24 * 3600 * 1000);
console.log(`  expires ${new Date(Number(expiry) * 1000).toISOString()} (${years.toFixed(1)} years). Every username dies with it: renew it for many years in the ENS app.`);

console.log("1. Subname registry (UserRegistry) for rumalatam.eth");
const registry = await deployProxy(
  "UserRegistry",
  USER_REGISTRY_IMPL,
  REGISTRY_SALT,
  encodeFunctionData({ abi: registryAbi, functionName: "initialize", args: [[{ account: owner, roleBitmap: REGISTRY_OWNER_ROLES }]] })
);

console.log("2. Resolver for usernames (PermissionedResolver), separate from rumalatam.eth's own");
const resolver = await deployProxy(
  "PermissionedResolver",
  PERMISSIONED_RESOLVER_IMPL,
  RESOLVER_SALT,
  encodeFunctionData({ abi: resolverAbi, functionName: "initialize", args: [[{ account: owner, roleBitmap: RESOLVER_OWNER_ROLES }], []] })
);

console.log("3. RumaRegistrar");
let registrar = process.env.RUMA_REGISTRAR_ADDRESS?.trim();
if (registrar && (await hasCode(registrar))) {
  console.log(`  already deployed at ${registrar}`);
} else if (!send) {
  console.log(`  would deploy RumaRegistrar(${registry}, ${resolver}, ${dnsEncode("rumalatam.eth")}, ${owner}, ${claimer})`);
  console.log("  (steps 4-7 need its address, so the dry run stops here)");
  process.exit(0);
} else {
  console.log("  sending: deploy RumaRegistrar");
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [registry, resolver, dnsEncode("rumalatam.eth"), owner, claimer],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`RumaRegistrar deploy failed (${hash})`);
  registrar = receipt.contractAddress;
  console.log(`  done: ${registrar}. Re-runs: pass RUMA_REGISTRAR_ADDRESS=${registrar}`);
}

console.log("4. Let the registrar register labels");
if (await pub.readContract({ address: registry, abi: registryAbi, functionName: "hasRootRoles", args: [REG.REGISTRAR, registrar] })) {
  console.log("  already granted");
} else {
  await tx("registry.grantRootRoles(ROLE_REGISTRAR, registrar)", { address: registry, abi: registryAbi, functionName: "grantRootRoles", args: [REG.REGISTRAR, registrar] });
}

console.log("5. Let the registrar write address records (and nothing else) on the username resolver");
if (await pub.readContract({ address: resolver, abi: resolverAbi, functionName: "hasRootRoles", args: [RES.SET_ADDRESS, registrar] })) {
  console.log("  already granted");
} else {
  await tx("resolver.grantRootRoles(ROLE_SET_ADDRESS, registrar)", { address: resolver, abi: resolverAbi, functionName: "grantRootRoles", args: [RES.SET_ADDRESS, registrar] });
}

console.log("6. Record the registry's canonical place (rumalatam under .eth)");
await tx('registry.setParent(ETHRegistry, "rumalatam")', { address: registry, abi: registryAbi, functionName: "setParent", args: [ETH_REGISTRY, PARENT_LABEL] });

console.log("7. Attach the registry to rumalatam.eth");
const attached = await pub.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: "getSubregistry", args: [PARENT_LABEL] });
if (isAddressEqual(attached, registry)) {
  console.log("  already attached");
} else {
  await tx("ETHRegistry.setSubregistry(rumalatam, registry)", { address: ETH_REGISTRY, abi: registryAbi, functionName: "setSubregistry", args: [parentId, registry] });
}

console.log(`
Done. Set in the app's env:
  NEXT_PUBLIC_RUMA_REGISTRAR_ADDRESS=${registrar}
  ENS_WRITER_PRIVATE_KEY=<the claimer's key, server-only>
and send a little ETH to the claimer ${claimer} for gas.`);
