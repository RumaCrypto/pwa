import { isAddress, isAddressEqual, zeroAddress, type Address } from "viem";

import { handleProblem, parseHandle } from "./handle";
import { resolveHandle, type UsernameReader } from "./registrar";

/** Nobody has this username (or it can't exist). Shown as "Sorry, we could not find anyone…". */
export class UsernameNotFoundError extends Error {
  constructor(readonly label: string) {
    super(`No Ruma user is called ${label}`);
    this.name = "UsernameNotFoundError";
  }
}

/** The lookup itself failed (RPC down), so we don't know whether the username exists. */
export class UsernameLookupError extends Error {
  constructor() {
    super("Could not look up the username");
    this.name = "UsernameLookupError";
  }
}

/** What someone typed in the "Has Ruma" field. */
export type RumaRecipientInput =
  | { kind: "address"; address: Address }
  | { kind: "handle"; label: string }
  /** Starts with 0x but isn't a valid address. */
  | { kind: "invalidAddress" }
  /** Can't be a username (wrong length or characters), so nobody has it. */
  | { kind: "notFound"; label: string };

export function parseRumaRecipient(input: string): RumaRecipientInput {
  const trimmed = input.trim();
  if (/^0x/i.test(trimmed)) return isAddress(trimmed) ? { kind: "address", address: trimmed } : { kind: "invalidAddress" };

  const label = parseHandle(trimmed);
  // Reserved names are well formed and could belong to Ruma itself, so they are still looked up.
  const problem = handleProblem(label);
  return problem && problem !== "reserved" ? { kind: "notFound", label } : { kind: "handle", label };
}

/**
 * The Base address a username points to right now. Throws UsernameNotFoundError
 * if it points nowhere, and UsernameLookupError if the chain couldn't be read.
 */
export async function resolveRumaRecipient(reader: Pick<UsernameReader, "resolve">, label: string): Promise<Address> {
  let address: Address | null;
  try {
    address = await resolveHandle(reader, label);
  } catch {
    throw new UsernameLookupError();
  }
  if (!address || isAddressEqual(address, zeroAddress)) throw new UsernameNotFoundError(label);
  return address;
}
