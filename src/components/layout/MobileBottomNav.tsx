"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? "text-emerald-500" : "text-gray-400"}`} fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2}>
        <path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? "text-emerald-500" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="5" width="20" height="14" rx="2" fill={active ? "#dcfce7" : "none"} stroke={active ? "#10b981" : "currentColor"}/>
        <path d="M2 10h20" stroke={active ? "#10b981" : "currentColor"}/>
      </svg>
    ),
  },
  {
    href: "/budget",
    label: "Budget",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? "text-emerald-500" : "text-gray-400"}`} fill="none" stroke={active ? "#10b981" : "currentColor"} strokeWidth={2}>
        <circle cx="12" cy="12" r="9" fill={active ? "#dcfce7" : "none"}/>
        <path d="M12 7v5l3 3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/savings",
    label: "Savings",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? "text-emerald-500" : "text-gray-400"}`} fill="none" stroke={active ? "#10b981" : "currentColor"} strokeWidth={2}>
        <path d="M12 2C9 2 6 4.5 6 7.5c0 4 6 11 6 11s6-7 6-11C18 4.5 15 2 12 2z" fill={active ? "#dcfce7" : "none"}/>
        <circle cx="12" cy="7.5" r="2" fill={active ? "#10b981" : "none"} stroke={active ? "#10b981" : "currentColor"}/>
      </svg>
    ),
  },
  {
    href: "/debt",
    label: "Debt",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? "text-emerald-500" : "text-gray-400"}`} fill="none" stroke={active ? "#10b981" : "currentColor"} strokeWidth={2}>
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/bills",
    label: "Bills",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? "text-emerald-500" : "text-gray-400"}`} fill="none" stroke={active ? "#10b981" : "currentColor"} strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill={active ? "#dcfce7" : "none"} stroke={active ? "#10b981" : "currentColor"}/>
        <circle cx="9" cy="7" r="4" fill={active ? "#dcfce7" : "none"} stroke={active ? "#10b981" : "currentColor"}/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 safe-area-inset-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex justify-around items-center py-2">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-0.5 px-2 py-1 min-w-0">
              {icon(active)}
              <span className={`text-[10px] font-medium truncate ${active ? "text-emerald-500" : "text-gray-400"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
