"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "@/lib/currency-context";

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW registered", reg.scope))
        .catch((err) => console.warn("SW registration failed", err));
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CurrencyProvider>
        <ServiceWorkerRegistrar />
        {children}
      </CurrencyProvider>
    </SessionProvider>
  );
}
