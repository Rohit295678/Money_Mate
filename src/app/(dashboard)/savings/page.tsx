"use client";
import { useEffect, useState } from "react";
import { useCurrency } from "@/lib/currency-context";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  contributions: { id: string; amount: number; note: string | null; date: string }[];
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [form, setForm] = useState({ name: "", targetAmount: "", deadline: "" });
  const [contrib, setContrib] = useState<Record<string, { amount: string; note: string }>>({});
  const [loading, setLoading] = useState(false);
  const { format, symbol } = useCurrency();

  async function fetchGoals() {
    const res = await fetch("/api/savings");
    setGoals(await res.json());
  }

  useEffect(() => { fetchGoals(); }, []);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/savings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, targetAmount: parseFloat(form.targetAmount) }),
    });
    setForm({ name: "", targetAmount: "", deadline: "" });
    setLoading(false);
    fetchGoals();
  }

  async function addContribution(goalId: string) {
    const c = contrib[goalId];
    if (!c?.amount) return;
    await fetch("/api/savings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, amount: parseFloat(c.amount), note: c.note }),
    });
    setContrib((p) => ({ ...p, [goalId]: { amount: "", note: "" } }));
    fetchGoals();
  }

  async function deleteGoal(id: string) {
    await fetch(`/api/savings?id=${id}`, { method: "DELETE" });
    fetchGoals();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Savings Goals</h2>
        <p className="text-sm text-gray-500 mt-1">Set targets and watch them grow</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">New Goal</h3>
          <form onSubmit={addGoal} className="space-y-3">
            <input type="text" placeholder="Goal name (e.g. Emergency Fund)" value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <input type="number" step="0.01" placeholder={`Target amount (${symbol})`} value={form.targetAmount}
              onChange={(e) => setForm((p) => ({ ...p, targetAmount: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Deadline (optional)</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {loading ? "Creating..." : "Create Goal"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {goals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
              No savings goals yet. Create your first one!
            </div>
          ) : (
            goals.map((g) => {
              const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
              const c = contrib[g.id] ?? { amount: "", note: "" };
              return (
                <div key={g.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{g.name}</p>
                      <p className="text-xs text-gray-400">
                        {format(g.currentAmount)} saved of {format(g.targetAmount)}
                      </p>
                      {g.deadline && (
                        <p className="text-xs text-gray-400">Deadline: {new Date(g.deadline).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-emerald-600">{pct.toFixed(0)}%</span>
                      <button onClick={() => deleteGoal(g.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" placeholder={`Add amount (${symbol})`} value={c.amount}
                      onChange={(e) => setContrib((p) => ({ ...p, [g.id]: { ...c, amount: e.target.value } }))}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <input type="text" placeholder="Note" value={c.note}
                      onChange={(e) => setContrib((p) => ({ ...p, [g.id]: { ...c, note: e.target.value } }))}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <button onClick={() => addContribution(g.id)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition">
                      Add
                    </button>
                  </div>
                  {g.contributions.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {g.contributions.map((c) => (
                        <div key={c.id} className="text-xs text-gray-400 flex justify-between">
                          <span>+{format(c.amount)} {c.note ? `— ${c.note}` : ""}</span>
                          <span>{new Date(c.date).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
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
