import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const userId = session.user.id;
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
    .prepare("SELECT limit_amount FROM budgets WHERE user_id = ? AND month = ? AND year = ?")
    .all(userId, month, year) as { limit_amount: number }[];

  const goals = db
    .prepare("SELECT current_amount FROM savings_goals WHERE user_id = ?")
    .all(userId) as { current_amount: number }[];

  const debts = db
    .prepare("SELECT total_amount, paid_amount FROM debts WHERE user_id = ?")
    .all(userId) as { total_amount: number; paid_amount: number }[];

  return NextResponse.json({
    totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
    totalBudget: budgets.reduce((s, b) => s + b.limit_amount, 0),
    totalSaved: goals.reduce((s, g) => s + g.current_amount, 0),
    totalDebt: debts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0),
    recentExpenses: expenses.slice(0, 5),
  });
}
