import type { CSSProperties } from "react";

type TypographyToken = Pick<CSSProperties, "fontSize" | "lineHeight" | "letterSpacing" | "fontWeight">;

/**
 * Design-token typography scale, ported from the mobile app's constants/typography.ts.
 *
 * Unlike React Native, React DOM treats a unitless `lineHeight` as a multiplier
 * (not px), so every value here is an explicit px string — the RN version's
 * bare numbers would otherwise blow up line spacing on web.
 *
 * Usage: <p style={typography.heading3}>...</p>, spread + override like RN:
 * style={{ ...typography.body4, fontWeight: 500 }}
 */
export const typography = {
  // ── Display ───────────────────────────────────────────
  display1: { fontSize: "54px", lineHeight: "56px", letterSpacing: "-2px", fontWeight: 700 },
  display2: { fontSize: "50px", lineHeight: "54px", letterSpacing: "-1.5px", fontWeight: 700 },
  display3: { fontSize: "32px", lineHeight: "36px", letterSpacing: "0px", fontWeight: 700 },
  display4: { fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.5px", fontWeight: 700 },
  display5: { fontSize: "26px", lineHeight: "30px", letterSpacing: "0px", fontWeight: 700 },
  display6: { fontSize: "24px", lineHeight: "28px", letterSpacing: "0px", fontWeight: 700 },

  // ── Heading ───────────────────────────────────────────
  heading1: { fontSize: "24px", lineHeight: "28px", letterSpacing: "0px", fontWeight: 700 },
  heading2: { fontSize: "20px", lineHeight: "24px", letterSpacing: "0px", fontWeight: 700 },
  heading3: { fontSize: "18px", lineHeight: "22px", letterSpacing: "0px", fontWeight: 700 },
  heading4: { fontSize: "16px", lineHeight: "20px", letterSpacing: "0px", fontWeight: 700 },
  heading5: { fontSize: "15px", lineHeight: "20px", letterSpacing: "0px", fontWeight: 700 },
  heading6: { fontSize: "14px", lineHeight: "18px", letterSpacing: "0px", fontWeight: 700 },

  // ── Body ──────────────────────────────────────────────
  body1: { fontSize: "16px", lineHeight: "24px", letterSpacing: "0px", fontWeight: 400 },
  body2: { fontSize: "15px", lineHeight: "22px", letterSpacing: "0px", fontWeight: 400 },
  body3: { fontSize: "14px", lineHeight: "20px", letterSpacing: "0px", fontWeight: 400 },
  body4: { fontSize: "13px", lineHeight: "18px", letterSpacing: "0px", fontWeight: 400 },
  body5: { fontSize: "12px", lineHeight: "18px", letterSpacing: "0px", fontWeight: 400 },
  body6: { fontSize: "11px", lineHeight: "16px", letterSpacing: "0px", fontWeight: 400 },
  body7: { fontSize: "10px", lineHeight: "14px", letterSpacing: "0px", fontWeight: 400 },

  // ── Label ─────────────────────────────────────────────
  label1: { fontSize: "16px", lineHeight: "20px", letterSpacing: "0px", fontWeight: 600 },
  label2: { fontSize: "15px", lineHeight: "20px", letterSpacing: "0px", fontWeight: 600 },
  label3: { fontSize: "13px", lineHeight: "16px", letterSpacing: "0px", fontWeight: 600 },
  label4: { fontSize: "12px", lineHeight: "16px", letterSpacing: "0px", fontWeight: 600 },
  label5: { fontSize: "11px", lineHeight: "14px", letterSpacing: "0px", fontWeight: 600 },
  label6: { fontSize: "10px", lineHeight: "14px", letterSpacing: "0px", fontWeight: 600 },
  label7: { fontSize: "9px", lineHeight: "12px", letterSpacing: "0px", fontWeight: 600 },

  // ── Caption (uppercase companion, positive tracking) ──
  caption1: { fontSize: "13px", lineHeight: "16px", letterSpacing: "0.8px", fontWeight: 600 },
  caption2: { fontSize: "12px", lineHeight: "16px", letterSpacing: "0.8px", fontWeight: 600 },
  caption3: { fontSize: "11px", lineHeight: "14px", letterSpacing: "0.8px", fontWeight: 600 },
  caption4: { fontSize: "10px", lineHeight: "12px", letterSpacing: "0.8px", fontWeight: 600 },
  caption5: { fontSize: "9px", lineHeight: "12px", letterSpacing: "0.6px", fontWeight: 600 },

  // ── Button ────────────────────────────────────────────
  button1: { fontSize: "15px", lineHeight: "20px", letterSpacing: "0px", fontWeight: 700 },
  button2: { fontSize: "13px", lineHeight: "18px", letterSpacing: "0px", fontWeight: 700 },
} satisfies Record<string, TypographyToken>;
