export const SUPPORT_URL = "https://t.me/danielarroyoeth";

/** Opens support in a new tab; on mobile the t.me link hands off to the Telegram app. */
export function openSupport() {
  window.open(SUPPORT_URL, "_blank", "noopener,noreferrer");
}
