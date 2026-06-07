"use client";
import { useEffect, useState } from "react";
import { useCurrency } from "@/lib/currency-context";
import dynamic from "next/dynamic";
import Link from "next/link";

const OverviewCharts = dynamic(() => import("@/components/charts/OverviewCharts"), { ssr: false });

interface DashboardData {
  totalSpent: number;
  totalBudget: number;
  totalSaved: number;
  totalDebt: number;
  recentExpenses: { id: string; amount: number; category: string; description: string | null; date: string }[];
  categoryBreakdown: { category: string; amount: number }[];
  budgetComparison: { category: string; fullCategory: string; budget: number; spent: number }[];
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function DashboardPage() {
  const { format } = useCurrency();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/dashboard?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [month, year]);

  const selectedLabel = `${MONTHS[month - 1]} ${year}`;
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const cards = data
    ? [
        {
          label: `Spent in ${selectedLabel}`,
          value: format(data.totalSpent),
          color: "text-red-600",
          bg: "bg-red-50",
        },
        {
          label: `Budget in ${selectedLabel}`,
          value: format(data.totalBudget),
          color: "text-blue-600",
          bg: "bg-blue-50",
        },
        {
          label: "Total Saved (all time)",
          value: format(data.totalSaved),
          color: "text-emerald-600",
          bg: "bg-emerald-50",
        },
        {
          label: "Total Debt Remaining",
          value: format(data.totalDebt),
          color: "text-orange-600",
          bg: "bg-orange-50",
        },
      ]
    : [];

  const quickLinks = [
    { href: "/expenses", label: "Add Expense", desc: "Log a new purchase" },
    { href: "/budget", label: "Set Budget", desc: "Define category limits" },
    { href: "/savings", label: "Save Money", desc: "Contribute to a goal" },
    { href: "/bills", label: "Split a Bill", desc: "Share costs with friends" },
    { href: "/debt", label: "Log Payment", desc: "Track debt payoff" },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
          <p className="text-gray-500 text-sm mt-1">
            Showing data for{" "}
            <span className="font-semibold text-gray-700">{selectedLabel}</span>
            {isCurrentMonth && (
              <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Current month
              </span>
            )}
          </p>
        </div>

        {/* Month / Year pickers */}
        <div className="flex gap-2 shrink-0">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {!isCurrentMonth && (
            <button
              onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()); }}
              className="px-3 py-2 text-sm text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-5 bg-gray-100 animate-pulse h-20" />
            ))
          : cards.map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-2xl p-5 ${bg}`}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
      </div>

      {/* Charts */}
      {data && (
        <OverviewCharts
          categoryBreakdown={data.categoryBreakdown}
          budgetComparison={data.budgetComparison}
        />
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickLinks.map(({ href, label, desc }) => (
            <Link key={href} href={href}
              className="flex flex-col gap-1 p-4 rounded-xl border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50 transition group">
              <span className="font-semibold text-sm text-gray-800 group-hover:text-emerald-700">{label}</span>
              <span className="text-xs text-gray-400">{desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Recent Expenses
            <span className="ml-2 text-sm font-normal text-gray-400">({selectedLabel})</span>
          </h3>
          <Link href="/expenses" className="text-sm text-emerald-600 hover:underline">View all</Link>
        </div>
        {loading || !data ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : data.recentExpenses.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">
            No expenses recorded for {selectedLabel}.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{e.category}</p>
                  <p className="text-xs text-gray-400">{e.description ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">{format(e.amount)}</p>
                  <p className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
