"use client";

import type { ReactNode } from "react";
import { SendProvider } from "@/lib/send/send-context";

export default function SendLayout({ children }: { children: ReactNode }) {
  return <SendProvider>{children}</SendProvider>;
}
