import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: { userId: string; date?: { gte: Date; lte: Date } } = { userId };
  if (month && year) {
    const m = Number(month);
    const y = Number(year);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return jsonResponse(expenses);
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { amount, category, description, date } = await req.json();
  if (!amount || !category)
    return jsonResponse({ error: "Amount and category required" }, { status: 400 });

  const expense = await prisma.expense.create({
    data: {
      userId,
      amount: Number(amount),
      category,
      description: description ?? null,
      date: date ? new Date(date) : new Date(),
    },
  });
  return jsonResponse(expense, { status: 201 });
}

export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return jsonResponse({ error: "ID required" }, { status: 400 });

  await prisma.expense.deleteMany({ where: { id, userId } });
  return jsonResponse({ success: true });
}
