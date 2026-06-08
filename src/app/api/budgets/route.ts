import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

type DbBudget = {
  id: string;
  userId: string;
  category: string;
  limitAmount: number;
  month: number;
  year: number;
  createdAt: Date;
};

function toApiShape(b: DbBudget) {
  return {
    id: b.id,
    user_id: b.userId,
    category: b.category,
    limit_amount: b.limitAmount,
    month: b.month,
    year: b.year,
    created_at: b.createdAt,
  };
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());

  const budgets = await prisma.budget.findMany({
    where: { userId, month, year },
  });
  return jsonResponse(budgets.map(toApiShape));
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { category, limit, month, year } = await req.json();
  const m = Number(month ?? new Date().getMonth() + 1);
  const y = Number(year ?? new Date().getFullYear());

  const budget = await prisma.budget.upsert({
    where: {
      userId_category_month_year: {
        userId,
        category,
        month: m,
        year: y,
      },
    },
    update: { limitAmount: Number(limit) },
    create: {
      userId,
      category,
      limitAmount: Number(limit),
      month: m,
      year: y,
    },
  });
  return jsonResponse(toApiShape(budget));
}

export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return jsonResponse({ error: "ID required" }, { status: 400 });

  await prisma.budget.deleteMany({ where: { id, userId } });
  return jsonResponse({ success: true });
}
