"use client";

import type { ReactNode } from "react";
import { DepositProvider } from "@/lib/deposit/deposit-context";

export default function AddMoneyBankLayout({ children }: { children: ReactNode }) {
  return <DepositProvider>{children}</DepositProvider>;
}
