import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());

  const budgets = await prisma.budget.findMany({
    where: { userId: session.user.id, month, year },
  });
  return NextResponse.json(budgets.map(toApiShape));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, limit, month, year } = await req.json();
  const m = Number(month ?? new Date().getMonth() + 1);
  const y = Number(year ?? new Date().getFullYear());

  const budget = await prisma.budget.upsert({
    where: {
      userId_category_month_year: {
        userId: session.user.id,
        category,
        month: m,
        year: y,
      },
    },
    update: { limitAmount: Number(limit) },
    create: {
      userId: session.user.id,
      category,
      limitAmount: Number(limit),
      month: m,
      year: y,
    },
  });
  return NextResponse.json(toApiShape(budget));
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.budget.deleteMany({
    where: { id, userId: session.user.id },
  });
  return NextResponse.json({ success: true });
}
