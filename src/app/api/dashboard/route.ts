import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const year = Number(searchParams.get("year") ?? now.getFullYear());

  const db = getDb();
  const userId = session.user.id;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")} 23:59:59`;

  const expenses = db
    .prepare("SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC")
    .all(userId, start, end) as { id: string; amount: number; category: string; description: string | null; date: string }[];

  const budgets = db
    .prepare("SELECT category, limit_amount FROM budgets WHERE user_id = ? AND month = ? AND year = ?")
    .all(userId, month, year) as { category: string; limit_amount: number }[];

  const goals = db
    .prepare("SELECT current_amount FROM savings_goals WHERE user_id = ?")
    .all(userId) as { current_amount: number }[];

  const debts = db
    .prepare("SELECT total_amount, paid_amount FROM debts WHERE user_id = ?")
    .all(userId) as { total_amount: number; paid_amount: number }[];

  // Aggregate expenses by category for pie chart
  const spentByCategory: Record<string, number> = {};
  for (const e of expenses) {
    spentByCategory[e.category] = (spentByCategory[e.category] ?? 0) + e.amount;
  }
  const categoryBreakdown = Object.entries(spentByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Budget vs actual per category for bar chart
  const budgetMap: Record<string, number> = {};
  for (const b of budgets) budgetMap[b.category] = b.limit_amount;

  const allCategories = Array.from(
    new Set([...Object.keys(spentByCategory), ...Object.keys(budgetMap)])
  );
  const budgetComparison = allCategories.map((category) => ({
    category: category.length > 12 ? category.slice(0, 11) + "…" : category,
    fullCategory: category,
    budget: budgetMap[category] ?? 0,
    spent: spentByCategory[category] ?? 0,
  }));

  return NextResponse.json({
    totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
    totalBudget: budgets.reduce((s, b) => s + b.limit_amount, 0),
    totalSaved: goals.reduce((s, g) => s + g.current_amount, 0),
    totalDebt: debts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0),
    recentExpenses: expenses.slice(0, 5),
    categoryBreakdown,
    budgetComparison,
  });
}
