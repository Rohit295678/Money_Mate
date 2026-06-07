"use client";
import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES, CATEGORY_COLORS } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";

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
  const [form, setForm] = useState({ amount: "", category: EXPENSE_CATEGORIES[0], description: "", date: "" });
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
  const byCategory = EXPENSE_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {});

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
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
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
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
              {EXPENSE_CATEGORIES.filter((c) => byCategory[c] > 0).map((c) => (
                <div key={c} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                    {c}
                  </span>
                  <span className="font-medium">{format(byCategory[c])}</span>
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
            <div className="divide-y divide-gray-50">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-3 group">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[e.category] }} />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{e.category}</p>
                      {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">{format(e.amount)}</p>
                      <p className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => deleteExpense(e.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
