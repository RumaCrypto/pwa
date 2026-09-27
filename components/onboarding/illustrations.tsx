/**
 * Onboarding slide illustrations — layered, gradient-rich vignettes tuned to the
 * brand (deep blue with a lime accent from the palette). Each is pure SVG so it
 * scales crisply on any screen and stays in sync with the design tokens instead
 * of shipping raster assets. Gradient ids are namespaced per illustration so
 * several can render on the same page without clashing.
 */
import type { SVGProps } from "react";

const svg: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 280 280",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Slide 1 — hold & manage your digital assets. */
export function WalletIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg} {...props}>
      <defs>
        <linearGradient id="wa-panel" x1="40" y1="44" x2="240" y2="236" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eef3ff" />
          <stop offset="1" stopColor="#d4e2ff" />
        </linearGradient>
        <linearGradient id="wa-card" x1="66" y1="98" x2="214" y2="202" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2f6bff" />
          <stop offset="1" stopColor="#0034bd" />
        </linearGradient>
        <linearGradient id="wa-coin" x1="174" y1="58" x2="218" y2="102" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ecff6b" />
          <stop offset="1" stopColor="#b6e000" />
        </linearGradient>
      </defs>

      <rect x="40" y="44" width="200" height="192" rx="52" fill="url(#wa-panel)" />
      <circle cx="140" cy="122" r="70" fill="#ffffff" opacity="0.45" />

      <g transform="rotate(-9 140 150)">
        <rect x="72" y="106" width="136" height="94" rx="20" fill="#0a1f5c" opacity="0.12" />
        <rect x="66" y="98" width="148" height="104" rx="22" fill="url(#wa-card)" />
        <rect x="86" y="122" width="26" height="20" rx="5" fill="#DFFF00" opacity="0.92" />
        <rect x="86" y="158" width="120" height="9" rx="4.5" fill="#ffffff" opacity="0.4" />
        <rect x="86" y="174" width="72" height="9" rx="4.5" fill="#ffffff" opacity="0.28" />
      </g>

      <g>
        <ellipse cx="192" cy="96" rx="24" ry="7" fill="#0a1f5c" opacity="0.1" />
        <circle cx="192" cy="80" r="23" fill="url(#wa-coin)" />
        <circle cx="192" cy="80" r="23" stroke="#a9d400" strokeWidth="2" />
        <circle cx="192" cy="80" r="13" stroke="#6a8500" strokeWidth="3" opacity="0.55" />
      </g>
    </svg>
  );
}

/** Slide 2 — pay & transfer instantly with a QR. */
export function QrIllustration(props: SVGProps<SVGSVGElement>) {
  const dark = "#0a1f5c";
  return (
    <svg {...svg} {...props}>
      <defs>
        <linearGradient id="qr-panel" x1="40" y1="44" x2="240" y2="236" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eef3ff" />
          <stop offset="1" stopColor="#d4e2ff" />
        </linearGradient>
        <linearGradient id="qr-card" x1="70" y1="66" x2="210" y2="214" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3a72ff" />
          <stop offset="1" stopColor="#0034bd" />
        </linearGradient>
        <linearGradient id="qr-beam" x1="80" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DFFF00" stopOpacity="0" />
          <stop offset="0.5" stopColor="#DFFF00" />
          <stop offset="1" stopColor="#DFFF00" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="40" y="44" width="200" height="192" rx="52" fill="url(#qr-panel)" />

      {/* card holding the QR — bigger and higher-contrast so the code reads clearly */}
      <rect x="70" y="70" width="140" height="148" rx="26" fill={dark} opacity="0.12" />
      <rect x="66" y="60" width="148" height="148" rx="26" fill="url(#qr-card)" />
      <rect x="82" y="76" width="116" height="116" rx="16" fill="#ffffff" />

      {/* QR code: three finder patterns + data modules, so it reads as a real QR */}
      <g fill={dark}>
        {/* top-left finder */}
        <rect x="92" y="86" width="30" height="30" rx="7" />
        <rect x="99" y="93" width="16" height="16" rx="3.5" fill="#ffffff" />
        <rect x="103" y="97" width="8" height="8" rx="2" />
        {/* top-right finder */}
        <rect x="158" y="86" width="30" height="30" rx="7" />
        <rect x="165" y="93" width="16" height="16" rx="3.5" fill="#ffffff" />
        <rect x="169" y="97" width="8" height="8" rx="2" />
        {/* bottom-left finder */}
        <rect x="92" y="152" width="30" height="30" rx="7" />
        <rect x="99" y="159" width="16" height="16" rx="3.5" fill="#ffffff" />
        <rect x="103" y="163" width="8" height="8" rx="2" />
        {/* data modules */}
        <rect x="134" y="86" width="8" height="8" rx="2" />
        <rect x="134" y="100" width="8" height="8" rx="2" />
        <rect x="146" y="108" width="8" height="8" rx="2" />
        <rect x="134" y="132" width="14" height="14" rx="3" />
        <rect x="158" y="132" width="8" height="8" rx="2" />
        <rect x="172" y="140" width="8" height="8" rx="2" />
        <rect x="158" y="152" width="8" height="8" rx="2" />
        <rect x="172" y="164" width="14" height="14" rx="3" />
        <rect x="134" y="164" width="8" height="8" rx="2" />
        <rect x="148" y="172" width="8" height="8" rx="2" />
      </g>

      {/* scan frame brackets */}
      <g stroke="#DFFF00" strokeWidth="5" fill="none">
        <path d="M84 104V92a8 8 0 0 1 8-8h12" />
        <path d="M196 104V92a8 8 0 0 0-8-8h-12" />
        <path d="M84 164v12a8 8 0 0 0 8 8h12" />
        <path d="M196 164v12a8 8 0 0 1-8 8h-12" />
      </g>

      {/* scan beam */}
      <ellipse cx="140" cy="134" rx="60" ry="12" fill="#DFFF00" opacity="0.22" />
      <rect x="80" y="131" width="120" height="5" rx="2.5" fill="url(#qr-beam)" />
    </svg>
  );
}

/** Slide 1 — send money between Latin American countries. */
export function SendMoneyIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg} {...props}>
      <defs>
        <linearGradient id="sm-panel" x1="40" y1="44" x2="240" y2="236" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eef3ff" />
          <stop offset="1" stopColor="#d4e2ff" />
        </linearGradient>
        <linearGradient id="sm-globe" x1="84" y1="96" x2="196" y2="208" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3a72ff" />
          <stop offset="1" stopColor="#0034bd" />
        </linearGradient>
        <linearGradient id="sm-coin" x1="128" y1="66" x2="152" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ecff6b" />
          <stop offset="1" stopColor="#b6e000" />
        </linearGradient>
      </defs>

      <rect x="40" y="44" width="200" height="192" rx="52" fill="url(#sm-panel)" />

      {/* globe */}
      <circle cx="140" cy="154" r="58" fill="#0a1f5c" opacity="0.1" transform="translate(0 5)" />
      <circle cx="140" cy="154" r="58" fill="url(#sm-globe)" />
      <g stroke="#ffffff" fill="none" strokeWidth="3">
        <ellipse cx="140" cy="154" rx="22" ry="58" opacity="0.35" />
        <ellipse cx="140" cy="154" rx="44" ry="58" opacity="0.2" />
        <line x1="82" y1="154" x2="198" y2="154" opacity="0.35" />
        <ellipse cx="140" cy="154" rx="58" ry="24" opacity="0.22" />
      </g>
      {/* landmass hints */}
      <g fill="#ffffff" opacity="0.85">
        <path d="M112 128c8-4 20-2 22 4s-6 12-14 12-16-12-8-16z" />
        <path d="M150 150c10 0 18 8 14 16s-18 6-22-2 0-14 8-14z" />
      </g>

      {/* transfer arc + coin */}
      <path d="M96 116Q140 62 184 116" stroke="#DFFF00" strokeWidth="5" strokeDasharray="2 11" fill="none" />
      <path d="M176 108l10 10-14 4z" fill="#DFFF00" />

      {/* origin & destination pins */}
      <g>
        <path d="M96 132c-9-9-9-19 0-27 9 8 9 18 0 27z" fill="#ffffff" />
        <circle cx="96" cy="111" r="5" fill="#0034bd" />
      </g>

      {/* flying coin */}
      <ellipse cx="140" cy="86" rx="18" ry="6" fill="#0a1f5c" opacity="0.1" />
      <circle cx="140" cy="72" r="16" fill="url(#sm-coin)" />
      <circle cx="140" cy="72" r="16" stroke="#a9d400" strokeWidth="2" />
      <circle cx="140" cy="72" r="8" stroke="#6a8500" strokeWidth="2.5" opacity="0.55" />
    </svg>
  );
}
