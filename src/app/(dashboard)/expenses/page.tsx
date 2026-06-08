"use client";
import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES, CATEGORY_COLORS } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import CategorySelect from "@/components/ui/CategorySelect";

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
}

export default function ExpensesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<{
    amount: string;
    category: string;
    description: string;
    date: string;
  }>({ amount: "", category: EXPENSE_CATEGORIES[0], description: "", date: "" });
  const [loading, setLoading] = useState(false);
  const { format, symbol } = useCurrency();

  async function fetchExpenses() {
    const res = await fetch(`/api/expenses?month=${month}&year=${year}`);
    const data = await res.json();
    setExpenses(data);
  }

  useEffect(() => { fetchExpenses(); }, [month, year]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setForm({ amount: "", category: EXPENSE_CATEGORIES[0], description: "", date: "" });
    setLoading(false);
    fetchExpenses();
  }

  async function deleteExpense(id: string) {
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    fetchExpenses();
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  // Build byCategory from actual expense data so custom categories are included
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  // Group expenses by calendar day (local) — newest day first.
  // Bucket key is YYYY-MM-DD so it sorts lexicographically the same as
  // chronologically; we then reverse for descending order.
  const groupedByDate = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (acc[key] ||= []).push(e);
    return acc;
  }, {});
  const sortedDays = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  function formatDayHeading(key: string) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const cmp = date.getTime();
    if (cmp === today.getTime()) return "Today";
    if (cmp === yesterday.getTime()) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      weekday: "short",
    });
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Expenses</h2>
          <p className="text-sm text-gray-500 mt-1">Track every dollar you spend</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
            {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Expense</h3>
          <form onSubmit={addExpense} className="space-y-3">
            <input type="number" step="0.01" placeholder={`Amount (${symbol})`} value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <CategorySelect
              value={form.category}
              onChange={(val) => setForm((p) => ({ ...p, category: val }))}
            />
            <input type="text" placeholder="Description (optional)" value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <button type="submit" disabled={loading}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {loading ? "Adding..." : "Add Expense"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">By Category</p>
            <div className="space-y-2">
              {Object.entries(byCategory).filter(([, v]) => v > 0).map(([c, amount]) => (
                <div key={c} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                    {c}
                  </span>
                  <span className="font-medium">{format(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Transactions ({expenses.length})
            </h3>
            <span className="text-lg font-bold text-red-600">{format(total)}</span>
          </div>
          {expenses.length === 0 ? (
            <p className="text-gray-400 text-sm py-12 text-center">No expenses yet. Add your first one!</p>
          ) : (
            <div className="space-y-5">
              {sortedDays.map((day) => {
                const items = groupedByDate[day];
                const dayTotal = items.reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={day}>
                    <div className="flex items-center justify-between mb-2 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-bold text-gray-800">
                        {formatDayHeading(day)}
                      </h4>
                      <span className="text-sm font-bold text-gray-800">
                        {format(dayTotal)}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {items.map((e) => (
                        <div key={e.id} className="flex items-center justify-between py-2.5 group">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ background: CATEGORY_COLORS[e.category] }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{e.category}</p>
                              {e.description && (
                                <p className="text-xs text-gray-400 truncate">{e.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <p className="text-sm font-semibold text-gray-800">{format(e.amount)}</p>
                            <button
                              onClick={() => deleteExpense(e.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
