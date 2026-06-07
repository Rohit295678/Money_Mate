"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { CurrencyCode, formatCurrency as fmt } from "@/lib/utils";

const LS_KEY = "moneymate-currency";

interface CurrencyCtx {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  format: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyCtx>({
  currency: "USD",
  setCurrency: () => {},
  format: (n) => fmt(n, "USD"),
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as CurrencyCode | null;
    if (saved) setCurrencyState(saved);
  }, []);

  function setCurrency(c: CurrencyCode) {
    setCurrencyState(c);
    localStorage.setItem(LS_KEY, c);
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format: (n) => fmt(n, currency) }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
