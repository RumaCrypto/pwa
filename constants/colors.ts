// Ported 1:1 from the mobile app's constants/colors.ts so the PWA matches the
// existing brand. Also mirrored as CSS custom properties in app/globals.css
// (Tailwind's `@theme`) — keep both in sync if these change.
export const colors = {
  // Primary colors
  background: "#fafafa",
  primary: "#0057ff",
  primaryLight: "#e6eeff",
  primaryDark: "#0a1f5c",

  // Text colors
  text: "#001610",
  textSecondary: "#999",
  textTertiary: "#666",
  textDisabled: "#555",
  textMuted: "#8A8A8A",

  // Background variations
  card: "#ededed",
  cardDark: "#2C2C2C",

  // Border colors
  border: "#333",
  borderDark: "#2A2A2A",
  borderLight: "#ededed",

  // Status colors
  success: "#4CAF50",
  danger: "#FF3B30",
  warning: "#FF9500",
  error: "#FF6B6B",

  // Transparent backgrounds
  overlay: "rgba(0, 0, 0, 0.7)",
  warningBackground: "rgba(255, 149, 0, 0.1)",
  warningBorder: "rgba(255, 149, 0, 0.3)",
  dangerBackground: "rgba(255, 59, 48, 0.1)",
  dangerBorder: "rgba(255, 59, 48, 0.3)",
  tintedBackground: "rgba(30, 144, 255, 0.1)",

  // Onramp / accent colors
  mintLight: "#E6FAF0",
  yellow: "#DFFF00",
  magenta: "#FF00FF",

  // Pure colors
  black: "#111111",
  white: "#fff",
} as const;
