"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CurrencyCode } from "@/lib/money/currencies";
import type { Payment } from "./payments";

const PAYMENTS_KEY = "ruma-payments";

interface PayContextType {
  draft: string;
  setDraft: (draft: string) => void;
  savePayment: (payment: Payment) => void;
  getPayment: (id: string) => Payment | undefined;
  /** Records that the merchant's QR reached the payer, advancing the payment. */
  markScanned: (id: string) => void;
}

const PayContext = createContext<PayContextType | undefined>(undefined);

type SerialisedMoney = { amount: string; currency: CurrencyCode };

function reviveMoney(value: unknown) {
  const money = value as SerialisedMoney;
  return { amount: BigInt(money.amount), currency: money.currency };
}

function readPayments(): Payment[] {
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    if (!raw) return [];

    return (JSON.parse(raw) as unknown[]).map((entry) => {
      const payment = entry as Payment & {
        createdAt: string;
        scannedAt?: string;
      };
      return {
        ...payment,
        amount: reviveMoney(payment.amount),
        fee: reviveMoney(payment.fee),
        total: reviveMoney(payment.total),
        createdAt: new Date(payment.createdAt),
        scannedAt: payment.scannedAt ? new Date(payment.scannedAt) : undefined,
      };
    });
  } catch {
    return [];
  }
}

function writePayments(payments: Payment[]): void {
  localStorage.setItem(
    PAYMENTS_KEY,
    JSON.stringify(payments, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
  );
}

export function PayProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("");

  const savePayment = useCallback((payment: Payment) => {
    writePayments([payment, ...readPayments()]);
  }, []);

  const getPayment = useCallback((id: string) => readPayments().find((p) => p.id === id), []);

  const markScanned = useCallback((id: string) => {
    const payments = readPayments();
    const index = payments.findIndex((payment) => payment.id === id);
    if (index === -1 || payments[index].scannedAt) return;

    payments[index] = { ...payments[index], scannedAt: new Date() };
    writePayments(payments);
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft, savePayment, getPayment, markScanned }),
    [draft, savePayment, getPayment, markScanned]
  );

  return <PayContext.Provider value={value}>{children}</PayContext.Provider>;
}

export function usePay() {
  const context = useContext(PayContext);
  if (!context) {
    throw new Error("usePay must be used within PayProvider");
  }
  return context;
}
