/**
 * Base URL for `/api/pix`, which `@p2pdotme/sdk/qr-parsers` calls (appending
 * `/pix` itself) to resolve a dynamic PIX QR's amount without hitting a CORS
 * wall in the browser. `undefined` during SSR, where no PIX QR is ever parsed.
 */
export function pixProxyUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/api`;
}
