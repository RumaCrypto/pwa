export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Derives avatar initials. Feed it the name as displayed, not the full legal
 * name: "Rosa" gives R, matching the designs, while "Rosa Cedeño" would give RC.
 */
export function initialsFrom(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => [...word].find((char) => /\p{L}|\p{N}/u.test(char)))
    .filter((char): char is string => Boolean(char));

  if (letters.length === 0) return "?";
  return letters.slice(0, 2).join("").toUpperCase();
}
