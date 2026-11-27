/**
 * Flattens an error and its `cause` chain into one readable line. The p2p SDK
 * wraps every wallet failure as "walletClient.sendTransaction rejected" and
 * keeps the real reason (Privy, paymaster, RPC) only in `cause`.
 */
export function describeError(error: unknown, maxDepth = 6): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && depth < maxDepth; depth++) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      const label = code !== undefined ? `${current.name} [${String(code)}]` : current.name;
      const message =
        (current as { shortMessage?: string }).shortMessage ?? current.message;
      parts.push(`${label}: ${message}`);
      current = current.cause;
    } else {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
  }
  return parts.join(" ← ");
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
