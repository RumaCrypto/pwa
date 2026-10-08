import { NextRequest } from "next/server";
import { handleQuote } from "@/lib/intents/quote-handler";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleQuote(request, "dry");
}
