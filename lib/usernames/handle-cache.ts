/**
 * The last username seen for an address, kept so the home header can show it
 * without waiting on an Ethereum RPC. Display only: sending always resolves
 * the name on-chain, so a stale or edited value here can't redirect money.
 */
type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const OLD_NAME_PREFIX = "ruma-username:";

export function handleCacheKey(address: string): string {
  return `ruma-handle:${address.toLowerCase()}`;
}

export function readCachedHandle(store: KeyValueStore, address: string): string | null {
  try {
    return store.getItem(handleCacheKey(address)) || null;
  } catch {
    return null;
  }
}

/** `null` forgets the name, for when the chain says the address has none. */
export function writeCachedHandle(store: KeyValueStore, address: string, label: string | null): void {
  try {
    if (label) store.setItem(handleCacheKey(address), label);
    else store.removeItem(handleCacheKey(address));
  } catch {
    // Private mode or full storage: the header just waits for the chain next time.
  }
}

/** Drops the free-text names the app stored before usernames moved to ENS. */
export function forgetOldNames(store: Storage): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(OLD_NAME_PREFIX)) stale.push(key);
    }
    stale.forEach((key) => store.removeItem(key));
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
