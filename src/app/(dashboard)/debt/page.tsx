"use client";
import { useEffect, useState } from "react";
import { useCurrency } from "@/lib/currency-context";

interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  paidAmount: number;
  interestRate: number;
  minimumPayment: number;
  dueDate: string | null;
  payments: { id: string; amount: number; date: string }[];
}

export default function DebtPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [form, setForm] = useState({ name: "", totalAmount: "", interestRate: "", minimumPayment: "", dueDate: "" });
  const [payment, setPayment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { format } = useCurrency();

  async function fetchDebts() {
    const res = await fetch("/api/debts");
    setDebts(await res.json());
  }

  useEffect(() => { fetchDebts(); }, []);

  async function addDebt(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, totalAmount: parseFloat(form.totalAmount), interestRate: parseFloat(form.interestRate || "0"), minimumPayment: parseFloat(form.minimumPayment || "0") }),
    });
    setForm({ name: "", totalAmount: "", interestRate: "", minimumPayment: "", dueDate: "" });
    setLoading(false);
    fetchDebts();
  }

  async function makePayment(debtId: string) {
    const amount = payment[debtId];
    if (!amount) return;
    await fetch("/api/debts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debtId, amount: parseFloat(amount) }),
    });
    setPayment((p) => ({ ...p, [debtId]: "" }));
    fetchDebts();
  }

  async function deleteDebt(id: string) {
    await fetch(`/api/debts?id=${id}`, { method: "DELETE" });
    fetchDebts();
  }

  const totalDebt = debts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Debt Payoff Planner</h2>
          <p className="text-sm text-gray-500 mt-1">Crush your debt systematically</p>
        </div>
        {debts.length > 0 && (
          <div className="bg-orange-50 rounded-xl px-4 py-2 text-right">
            <p className="text-xs text-orange-500">Total Remaining</p>
            <p className="text-xl font-bold text-orange-600">{format(totalDebt)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Debt</h3>
          <form onSubmit={addDebt} className="space-y-3">
            {[
              { key: "name", label: "Debt name", placeholder: "e.g. Credit Card", type: "text" },
              { key: "totalAmount", label: "Total amount ($)", placeholder: "5000", type: "number" },
              { key: "interestRate", label: "Interest rate (%)", placeholder: "18.9", type: "number" },
              { key: "minimumPayment", label: "Minimum payment ($)", placeholder: "100", type: "number" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type={type} step="0.01" placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  required={key === "name" || key === "totalAmount"}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Due date (optional)</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {loading ? "Adding..." : "Add Debt"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {debts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
              No debts tracked. Great news... or add one to start planning!
            </div>
          ) : (
            debts.map((d) => {
              const remaining = d.totalAmount - d.paidAmount;
              const pct = (d.paidAmount / d.totalAmount) * 100;
              return (
                <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{d.name}</p>
                      <p className="text-xs text-gray-400">
                        {format(d.paidAmount)} paid / {format(remaining)} remaining
                      </p>
                      <p className="text-xs text-gray-400">
                        {d.interestRate}% APR | Min payment: {format(d.minimumPayment)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-emerald-600">{pct.toFixed(0)}%</span>
                      <button onClick={() => deleteDebt(d.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" placeholder="Payment amount ($)"
                      value={payment[d.id] ?? ""}
                      onChange={(e) => setPayment((p) => ({ ...p, [d.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <button onClick={() => makePayment(d.id)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition">
                      Pay
                    </button>
                  </div>
                  {d.payments.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {d.payments.map((p) => (
                        <div key={p.id} className="text-xs text-gray-400 flex justify-between">
                          <span>Payment: {format(p.amount)}</span>
                          <span>{new Date(p.date).toLocaleDateString()}</span>
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
