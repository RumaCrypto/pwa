import { describe, expect, it } from "vitest";
import { forgetOldNames, handleCacheKey, readCachedHandle, writeCachedHandle } from "./handle-cache";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const ADDRESS = "0xAbCdEf0000000000000000000000000000000001";

describe("handle cache", () => {
  it("keys by lowercased address, so checksum case doesn't split the cache", () => {
    expect(handleCacheKey(ADDRESS)).toBe(handleCacheKey(ADDRESS.toLowerCase()));
  });

  it("stores, reads and forgets a label", () => {
    const store = memoryStorage();
    writeCachedHandle(store, ADDRESS, "daniel");
    expect(readCachedHandle(store, ADDRESS)).toBe("daniel");
    writeCachedHandle(store, ADDRESS, null);
    expect(readCachedHandle(store, ADDRESS)).toBeNull();
  });

  it("treats unavailable storage as an empty cache", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readCachedHandle(broken, ADDRESS)).toBeNull();
    expect(() => writeCachedHandle(broken, ADDRESS, "daniel")).not.toThrow();
  });
});

describe("forgetOldNames", () => {
  it("removes the old free-text names and nothing else", () => {
    const store = memoryStorage({
      "ruma-username:did:privy:a": "Daniel",
      "ruma-username:did:privy:b": "Ana",
      "ruma-contacts": "[]",
    });
    forgetOldNames(store);
    expect(store.length).toBe(1);
    expect(store.getItem("ruma-contacts")).toBe("[]");
  });
});
