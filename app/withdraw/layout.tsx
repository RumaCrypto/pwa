"use client";

import type { ReactNode } from "react";
import { WithdrawProvider } from "@/lib/withdraw/withdraw-context";

export default function WithdrawLayout({ children }: { children: ReactNode }) {
  return <WithdrawProvider>{children}</WithdrawProvider>;
}
