"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCurrency } from "@/lib/currency-context";
import { CURRENCIES } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/expenses", label: "Expenses", icon: "credit-card" },
  { href: "/budget", label: "Budget", icon: "pie-chart" },
  { href: "/bills", label: "Bill Splitter", icon: "users" },
  { href: "/savings", label: "Savings Goals", icon: "target" },
  { href: "/debt", label: "Debt Payoff", icon: "trending-down" },
];

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
    </svg>
  ),
  "credit-card": (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
      <path d="M2 10h20" strokeWidth="2" />
    </svg>
  ),
  "pie-chart": (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" strokeWidth="2" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" strokeWidth="2" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" />
      <circle cx="9" cy="7" r="4" strokeWidth="2" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" />
    </svg>
  ),
  target: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <circle cx="12" cy="12" r="6" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" strokeWidth="2" />
    </svg>
  ),
  "trending-down": (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" strokeWidth="2" />
      <polyline points="17 18 23 18 23 12" strokeWidth="2" />
    </svg>
  ),
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { currency, setCurrency } = useCurrency();

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-emerald-600">MoneyMate</h1>
        <p className="text-xs text-gray-400 mt-1">Personal Finance Hub</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className={active ? "text-emerald-600" : "text-gray-400"}>{ICONS[icon]}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="px-3 mb-3">
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm">
            {session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{session?.user?.name ?? "User"}</p>
            <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
