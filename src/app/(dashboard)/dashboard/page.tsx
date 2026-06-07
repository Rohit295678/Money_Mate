import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

async function getDashboardData(userId: string) {
  const db = getDb();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${daysInMonth} 23:59:59`;

  const expenses = db
    .prepare("SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC")
    .all(userId, start, end) as { id: string; amount: number; category: string; description: string | null; date: string }[];

  const budgets = db
    .prepare("SELECT * FROM budgets WHERE user_id = ? AND month = ? AND year = ?")
    .all(userId, month, year) as { limit_amount: number }[];

  const goals = db
    .prepare("SELECT current_amount FROM savings_goals WHERE user_id = ?")
    .all(userId) as { current_amount: number }[];

  const debts = db
    .prepare("SELECT total_amount, paid_amount FROM debts WHERE user_id = ?")
    .all(userId) as { total_amount: number; paid_amount: number }[];

  return {
    totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
    totalBudget: budgets.reduce((s, b) => s + b.limit_amount, 0),
    totalSaved: goals.reduce((s, g) => s + g.current_amount, 0),
    totalDebt: debts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0),
    recentExpenses: expenses.slice(0, 5),
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const data = await getDashboardData(session!.user.id);

  const cards = [
    { label: "Spent This Month", value: formatCurrency(data.totalSpent), color: "text-red-600", bg: "bg-red-50" },
    { label: "Total Budget", value: formatCurrency(data.totalBudget), color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Saved", value: formatCurrency(data.totalSaved), color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Debt Left", value: formatCurrency(data.totalDebt), color: "text-orange-600", bg: "bg-orange-50" },
  ];

  const quickLinks = [
    { href: "/expenses", label: "Add Expense", desc: "Log a new purchase" },
    { href: "/budget", label: "Set Budget", desc: "Define category limits" },
    { href: "/savings", label: "Save Money", desc: "Contribute to a goal" },
    { href: "/bills", label: "Split a Bill", desc: "Share costs with friends" },
    { href: "/debt", label: "Log Payment", desc: "Track debt payoff" },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl p-5 ${bg}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Recent Expenses</h3>
          <Link href="/expenses" className="text-sm text-emerald-600 hover:underline">View all</Link>
        </div>
        {data.recentExpenses.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">No expenses yet this month.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{e.category}</p>
                  <p className="text-xs text-gray-400">{e.description ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">{formatCurrency(e.amount)}</p>
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
