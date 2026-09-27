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

/** Slide 3 — your money protected with strong security. */
export function ShieldIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg} {...props}>
      <defs>
        <linearGradient id="sh-panel" x1="40" y1="44" x2="240" y2="236" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eef3ff" />
          <stop offset="1" stopColor="#d4e2ff" />
        </linearGradient>
        <linearGradient id="sh-shield" x1="88" y1="60" x2="192" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3a72ff" />
          <stop offset="1" stopColor="#0034bd" />
        </linearGradient>
      </defs>

      <rect x="40" y="44" width="200" height="192" rx="52" fill="url(#sh-panel)" />
      <circle cx="140" cy="132" r="72" fill="#ffffff" opacity="0.4" />

      <path
        d="M140 58l58 22v46c0 40-26 66-58 80-32-14-58-40-58-80V80l58-22z"
        fill="#0a1f5c"
        opacity="0.12"
        transform="translate(0 6)"
      />
      <path
        d="M140 58l58 22v46c0 40-26 66-58 80-32-14-58-40-58-80V80l58-22z"
        fill="url(#sh-shield)"
      />
      {/* glossy highlight */}
      <path d="M140 58l58 22v46c0 40-26 66-58 80V58z" fill="#ffffff" opacity="0.08" />

      {/* fingerprint */}
      <g stroke="#ffffff" strokeWidth="4" fill="none">
        <path d="M118 130a22 22 0 0 1 44 0v14" opacity="0.55" />
        <path d="M130 132a10 10 0 0 1 20 0v18" opacity="0.75" />
        <path d="M140 132v22" />
        <path d="M118 150c0 12 3 22 8 30" opacity="0.5" />
        <path d="M162 150c0 12-3 22-8 30" opacity="0.5" />
      </g>

      {/* sparks */}
      <circle cx="200" cy="86" r="5" fill="#DFFF00" />
      <circle cx="82" cy="150" r="4" fill="#DFFF00" opacity="0.8" />
    </svg>
  );
}
