"use client";
import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES, getProgressColor } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import CategorySelect from "@/components/ui/CategorySelect";

interface Budget { id: string; category: string; limit_amount: number; month: number; year: number }
interface Expense { amount: number; category: string }

export default function BudgetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], limit: "" });
  const [loading, setLoading] = useState(false);
  const { format, symbol } = useCurrency();

  async function fetchData() {
    const [bRes, eRes] = await Promise.all([
      fetch(`/api/budgets?month=${month}&year=${year}`),
      fetch(`/api/expenses?month=${month}&year=${year}`),
    ]);
    setBudgets(await bRes.json());
    setExpenses(await eRes.json());
  }

  useEffect(() => { fetchData(); }, [month, year]);

  async function upsertBudget(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, limit: parseFloat(form.limit), month, year }),
    });
    setForm({ category: EXPENSE_CATEGORIES[0], limit: "" });
    setLoading(false);
    fetchData();
  }

  async function deleteBudget(id: string) {
    await fetch(`/api/budgets?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  const spentByCategory = (cat: string) =>
    expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Budget Planner</h2>
          <p className="text-sm text-gray-500 mt-1">Set limits, track actuals</p>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Set Budget</h3>
          <form onSubmit={upsertBudget} className="space-y-3">
            <CategorySelect
              value={form.category}
              onChange={(val) => setForm((p) => ({ ...p, category: val }))}
            />
            <input type="number" step="0.01" placeholder={`Monthly limit (${symbol})`} value={form.limit}
              onChange={(e) => setForm((p) => ({ ...p, limit: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <button type="submit" disabled={loading}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {loading ? "Saving..." : "Save Budget"}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-3">Saving a budget that already exists will update its limit.</p>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {budgets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
              No budgets set. Create your first one!
            </div>
          ) : (
            budgets.map((b) => {
              const spent = spentByCategory(b.category);
              const pct = Math.min((spent / b.limit_amount) * 100, 100);
              return (
                <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{b.category}</p>
                      <p className="text-xs text-gray-400">
                        {format(spent)} of {format(b.limit_amount)} used
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${pct >= 100 ? "text-red-600" : pct >= 80 ? "text-yellow-600" : "text-emerald-600"}`}>
                        {pct.toFixed(0)}%
                      </span>
                      <button onClick={() => deleteBudget(b.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition">Delete</button>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${getProgressColor(pct)}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  {pct >= 100 && (
                    <p className="text-xs text-red-500 mt-2 font-medium">Over budget by {format(spent - b.limit_amount)}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
