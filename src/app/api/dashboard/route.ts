import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const year = Number(searchParams.get("year") ?? now.getFullYear());

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const [expenses, budgets, goals, debts] = await Promise.all([
    prisma.expense.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.budget.findMany({
      where: { userId, month, year },
      select: { category: true, limitAmount: true },
    }),
    prisma.savingsGoal.findMany({
      where: { userId },
      select: { currentAmount: true },
    }),
    prisma.debt.findMany({
      where: { userId },
      select: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const spentByCategory: Record<string, number> = {};
  for (const e of expenses) {
    spentByCategory[e.category] = (spentByCategory[e.category] ?? 0) + e.amount;
  }
  const categoryBreakdown = Object.entries(spentByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const budgetMap: Record<string, number> = {};
  for (const b of budgets) budgetMap[b.category] = b.limitAmount;

  const allCategories = Array.from(
    new Set([...Object.keys(spentByCategory), ...Object.keys(budgetMap)])
  );
  const budgetComparison = allCategories.map((category) => ({
    category: category.length > 12 ? category.slice(0, 11) + "…" : category,
    fullCategory: category,
    budget: budgetMap[category] ?? 0,
    spent: spentByCategory[category] ?? 0,
  }));

  return jsonResponse({
    totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
    totalBudget: budgets.reduce((s, b) => s + b.limitAmount, 0),
    totalSaved: goals.reduce((s, g) => s + g.currentAmount, 0),
    totalDebt: debts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0),
    recentExpenses: expenses.slice(0, 5),
    categoryBreakdown,
    budgetComparison,
  });
}
