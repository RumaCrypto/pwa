import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8000;

/**
 * CORS bypass for dynamic PIX QR codes: `@p2pdotme/sdk/qr-parsers` resolves a
 * dynamic PIX's amount by fetching a `locationUrl` pointed at whichever bank
 * issued the QR, which browsers can't do directly. This just forwards that
 * one GET and returns the bank's JWT response body as-is.
 *
 * Every Brazilian PSP runs its own domain for this, so there is no fixed
 * allowlist — the checks below only rule out the obviously-wrong shapes
 * (non-PIX schemes, loopback/link-local hosts) rather than pretending to
 * validate the target is a real bank.
 */
function isDisallowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  if (lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const locationUrl = request.nextUrl.searchParams.get("locationUrl");
  if (!locationUrl) {
    return NextResponse.json({ error: "Missing locationUrl" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(locationUrl);
  } catch {
    return NextResponse.json({ error: "Invalid locationUrl" }, { status: 400 });
  }

  if (target.protocol !== "https:" || isDisallowedHost(target.hostname)) {
    return NextResponse.json({ error: "locationUrl not allowed" }, { status: 400 });
  }

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: { Accept: "*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }
}
