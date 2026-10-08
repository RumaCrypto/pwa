/** Long enough for a first and last name, short enough for the home header chip. */
export const USERNAME_MAX_LENGTH = 24;

/** Per Privy user, so a second account signing in on the same device doesn't inherit the name. */
export function usernameKey(userId: string): string {
  return `ruma-username:${userId}`;
}

/** Blank input clears the name, so the email (or address) shows again. */
export function normalizeUsername(text: string): string | null {
  const name = text.trim().replace(/\s+/g, " ").slice(0, USERNAME_MAX_LENGTH).trim();
  return name || null;
}

export function emailName(email: string | undefined): string | null {
  const local = email?.split("@")[0]?.trim();
  return local || null;
}

/**
 * A name set in Settings wins over the email, which is all email sign-ups have
 * by default. Passkey-only users have neither until they set one, and the
 * header shows their address instead.
 */
export function displayNameFor({ username, email }: { username: string | null; email: string | undefined }): string | null {
  return username ?? emailName(email);
}
