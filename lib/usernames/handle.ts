/**
 * Ruma usernames are ENS subnames: "daniel" is daniel.rumalatam.eth.
 * Inside the app only the label is shown; the full name is for other wallets.
 */
export const ENS_PARENT = "rumalatam.eth";

/** Same limits as RumaRegistrar.isValidLabel, so the app never sends a claim the contract would reject. */
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;
const HANDLE_CHARACTERS = /^[a-z0-9]+$/;

/** Names that would let someone pose as Ruma staff. Checked by the claim route, not the contract. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin",
  "administrador",
  "ayuda",
  "help",
  "info",
  "official",
  "oficial",
  "ruma",
  "rumalatam",
  "security",
  "seguridad",
  "soporte",
  "suporte",
  "support",
  "team",
  "equipo",
  "wallet",
]);

export type HandleProblem = "tooShort" | "tooLong" | "invalidCharacters" | "reserved";

/**
 * Turns what someone typed or pasted ("Daniel", "@daniel", "daniel.rumalatam.eth")
 * into the bare label. Doesn't validate: pair with `handleProblem`.
 */
export function parseHandle(input: string): string {
  let label = input.trim().toLowerCase();
  if (label.startsWith("@")) label = label.slice(1);
  const suffix = `.${ENS_PARENT}`;
  if (label.endsWith(suffix)) label = label.slice(0, -suffix.length);
  return label;
}

export function handleProblem(label: string): HandleProblem | null {
  if (label.length < HANDLE_MIN_LENGTH) return "tooShort";
  if (label.length > HANDLE_MAX_LENGTH) return "tooLong";
  if (!HANDLE_CHARACTERS.test(label)) return "invalidCharacters";
  if (RESERVED_HANDLES.has(label)) return "reserved";
  return null;
}

export function fullEnsName(label: string): string {
  return `${label}.${ENS_PARENT}`;
}

/** How a username appears inside Ruma. */
export function formatHandle(label: string): string {
  return `@${label}`;
}

/**
 * A starting point for the onboarding field, taken from the email's local
 * part: "Daniel.Ruiz+ruma@mail.com" suggests "danielruiz". Null if too little
 * is left, or the result is reserved.
 */
export function suggestHandle(email: string | undefined): string | null {
  const local = email?.split("@")[0]?.split("+")[0] ?? "";
  const label = local.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, HANDLE_MAX_LENGTH);
  return handleProblem(label) ? null : label;
}
