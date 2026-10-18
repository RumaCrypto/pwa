/**
 * The Capacitor app (portApp) is served from its own origin inside the WebView
 * — capacitor://localhost on iOS, https://localhost on Android — and calls
 * these API routes cross-origin. Only those origins (plus Vite's dev server)
 * get CORS headers; browsers keep blocking every other site.
 */
const APP_ORIGINS = ["capacitor://localhost", "https://localhost", "http://localhost:5173"];

function allowedOrigins(): string[] {
  const extra = (process.env.CORS_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...APP_ORIGINS, ...extra];
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins().includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function withCors(request: Request, response: Response): Response {
  for (const [name, value] of Object.entries(corsHeaders(request.headers.get("Origin")))) {
    response.headers.set(name, value);
  }
  return response;
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("Origin")) });
}

/** Wraps a route handler so every answer it gives, refusals included, carries the CORS headers. */
export function cors<R extends Request>(handler: (request: R) => Promise<Response>): (request: R) => Promise<Response> {
  return async (request) => withCors(request, await handler(request));
}
