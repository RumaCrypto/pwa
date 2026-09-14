"use client";

import type { ReactNode } from "react";
import { PayProvider } from "@/lib/pay/pay-context";

export default function PayLayout({ children }: { children: ReactNode }) {
  return <PayProvider>{children}</PayProvider>;
}
