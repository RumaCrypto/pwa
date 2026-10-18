import { NextRequest } from "next/server";
import { cors, preflight } from "@/lib/http/cors";
import { handleQuote } from "@/lib/intents/quote-handler";

export const runtime = "nodejs";

async function handlePost(request: NextRequest) {
  return handleQuote(request, "live");
}

export const POST = cors(handlePost);
export const OPTIONS = preflight;
