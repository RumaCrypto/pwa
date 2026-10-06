import { describe, expect, it } from "vitest";
import { USERNAME_MAX_LENGTH, displayNameFor, emailName, normalizeUsername, usernameKey } from "./username";

describe("normalizeUsername", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeUsername("  Manu   Leca  ")).toBe("Manu Leca");
  });

  it("treats blank input as clearing the name", () => {
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername("   ")).toBeNull();
  });

  it("caps the length so the header chip never overflows", () => {
    expect(normalizeUsername("a".repeat(40))).toBe("a".repeat(USERNAME_MAX_LENGTH));
  });
});

describe("emailName", () => {
  it("uses the part before the @", () => {
    expect(emailName("nleclan98@gmail.com")).toBe("nleclan98");
  });

  it("returns null without a usable email", () => {
    expect(emailName(undefined)).toBeNull();
    expect(emailName("")).toBeNull();
    expect(emailName("@gmail.com")).toBeNull();
  });
});

describe("displayNameFor", () => {
  it("prefers the name chosen in Settings", () => {
    expect(displayNameFor({ username: "Manu", email: "nleclan98@gmail.com" })).toBe("Manu");
  });

  it("falls back to the email's local part", () => {
    expect(displayNameFor({ username: null, email: "nleclan98@gmail.com" })).toBe("nleclan98");
  });

  it("returns null for passkey-only users with no name set, so the address shows instead", () => {
    expect(displayNameFor({ username: null, email: undefined })).toBeNull();
  });
});

describe("usernameKey", () => {
  it("is scoped to the Privy user, so two accounts on one device don't share a name", () => {
    expect(usernameKey("did:privy:abc")).toBe("ruma-username:did:privy:abc");
  });
});
