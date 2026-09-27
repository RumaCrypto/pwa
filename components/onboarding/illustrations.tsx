/**
 * Onboarding slide illustrations — flat, brand-consistent vignettes.
 *
 * Deliberately restrained: the app is blue-first, so these stay within the
 * blue/white design tokens over a soft `primaryLight` disc, with a single warm
 * amber accent (never green) for the money highlight. Pure SVG so they scale
 * crisply and track the tokens instead of shipping raster assets. Swap `ACCENT`
 * alone to retune the highlight (e.g. to the danger red).
 */
import type { SVGProps } from "react";

const svg: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 280 280",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const NAVY = "#0a1f5c";
const BLUE = "#0057ff";
const BLUE_SOFT = "#6f9bff";
const PALE = "#e6eeff"; // colors.primaryLight
const PALE_2 = "#d4e2ff";
const WHITE = "#ffffff";
const ACCENT = "#FFB020"; // warm amber highlight (swap for danger red if preferred)
const ACCENT_DARK = "#B26A00";

/** Soft brand disc every slide shares, for a consistent, non-"sticker" backdrop. */
function Disc() {
  return (
    <>
      <circle cx="140" cy="140" r="96" fill={PALE} />
      <circle cx="140" cy="140" r="96" stroke={PALE_2} strokeWidth="2" />
    </>
  );
}

/** Slide 1 — send money straight to family & friends' local method. */
export function SendMoneyIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg} {...props}>
      <Disc />

      {/* recipient contact card */}
      <rect x="62" y="122" width="156" height="84" rx="18" fill={NAVY} opacity="0.06" transform="translate(0 6)" />
      <rect x="62" y="122" width="156" height="84" rx="18" fill={WHITE} />
      <circle cx="96" cy="152" r="17" fill={BLUE} />
      <circle cx="96" cy="147" r="6.5" fill={WHITE} />
      <path d="M83 164a13 13 0 0 1 26 0z" fill={WHITE} />
      <rect x="126" y="143" width="64" height="9" rx="4.5" fill={PALE_2} />
      <rect x="126" y="160" width="42" height="9" rx="4.5" fill={PALE} />

      {/* the money being sent — an amber bill */}
      <g transform="rotate(-10 150 78)">
        <rect x="118" y="56" width="64" height="42" rx="9" fill={NAVY} opacity="0.08" transform="translate(0 5)" />
        <rect x="118" y="56" width="64" height="42" rx="9" fill={ACCENT} />
        <circle cx="150" cy="77" r="11" fill="none" stroke={ACCENT_DARK} strokeWidth="3" />
        <path d="M150 71v12M146 74h6a2.5 2.5 0 0 1 0 5h-4a2.5 2.5 0 0 0 0 5h6" stroke={ACCENT_DARK} strokeWidth="2.4" fill="none" />
        <circle cx="129" cy="77" r="2.5" fill={ACCENT_DARK} />
        <circle cx="171" cy="77" r="2.5" fill={ACCENT_DARK} />
      </g>

      {/* motion into the recipient */}
      <path d="M150 104q4 12 -8 18" stroke={BLUE} strokeWidth="4" strokeDasharray="1.5 9" fill="none" />
      <path d="M136 118l6 6 6-8" stroke={BLUE} strokeWidth="4" fill="none" />
    </svg>
  );
}

/** Slide 2 — pay local QR codes in your country. */
export function QrIllustration(props: SVGProps<SVGSVGElement>) {
  // Build a 21x21 matrix (real QR "version 1" proportions): three finder
  // patterns, a timing row/column and a dense, deterministic data fill so it
  // reads like an actual scannable code rather than a few loose squares.
  const N = 21;
  const size = 60;
  const qx = 110;
  const qy = 110;
  const m = size / N;
  const finderZone = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  const finderOn = (x: number, y: number) => {
    for (const [bx, by] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      if (x >= bx && x < bx + 7 && y >= by && y < by + 7) {
        const lx = x - bx;
        const ly = y - by;
        const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6;
        const center = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
        return ring || center;
      }
    }
    return false;
  };
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let on: boolean;
      if (finderZone(x, y)) on = finderOn(x, y);
      else if (x === 6 || y === 6) on = (x + y) % 2 === 0; // timing pattern
      else on = (x * 17 + y * 31 + x * y * 7) % 13 < 6; // pseudo-random data
      if (on) cells.push([x, y]);
    }
  }

  return (
    <svg {...svg} {...props}>
      <Disc />

      {/* phone */}
      <rect x="94" y="60" width="92" height="160" rx="22" fill={NAVY} opacity="0.08" transform="translate(0 6)" />
      <rect x="94" y="60" width="92" height="160" rx="22" fill={BLUE} />
      <rect x="104" y="74" width="72" height="132" rx="13" fill={WHITE} />

      {/* QR matrix */}
      <g fill={NAVY}>
        {cells.map(([x, y], i) => (
          <rect key={i} x={qx + x * m} y={qy + y * m} width={m + 0.35} height={m + 0.35} rx="0.6" />
        ))}
      </g>

      {/* amber scan line */}
      <ellipse cx="140" cy="140" rx="34" ry="7" fill={ACCENT} opacity="0.25" />
      <rect x="108" y="137.5" width="64" height="4" rx="2" fill={ACCENT} />
    </svg>
  );
}

/** Slide 3 — your digital assets in one place. */
export function WalletIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg} {...props}>
      <Disc />

      {/* stacked cards = the account holding assets */}
      <rect x="82" y="104" width="128" height="82" rx="16" fill={BLUE_SOFT} transform="rotate(-8 146 145)" />
      <rect x="62" y="118" width="156" height="90" rx="18" fill={NAVY} opacity="0.08" transform="translate(0 6)" />
      <rect x="62" y="118" width="156" height="90" rx="18" fill={BLUE} />
      <rect x="84" y="146" width="26" height="19" rx="5" fill={ACCENT} />
      <g fill={WHITE} opacity="0.85">
        <rect x="84" y="180" width="46" height="8" rx="4" />
        <rect x="140" y="180" width="30" height="8" rx="4" opacity="0.7" />
      </g>

      {/* asset tokens */}
      <circle cx="196" cy="196" r="24" fill={NAVY} opacity="0.08" transform="translate(0 5)" />
      <circle cx="170" cy="200" r="17" fill={BLUE_SOFT} />
      <circle cx="196" cy="196" r="23" fill={ACCENT} />
      <path d="M196 184v24M189 190h9a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h9" stroke={ACCENT_DARK} strokeWidth="3" fill="none" />
    </svg>
  );
}
