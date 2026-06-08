import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: { userId: string; date?: { gte: Date; lte: Date } } = {
    userId: session.user.id,
  };
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
  return NextResponse.json(expenses);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, category, description, date } = await req.json();
  if (!amount || !category)
    return NextResponse.json({ error: "Amount and category required" }, { status: 400 });

  const expense = await prisma.expense.create({
    data: {
      userId: session.user.id,
      amount: Number(amount),
      category,
      description: description ?? null,
      date: date ? new Date(date) : new Date(),
    },
  });
  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.expense.deleteMany({
    where: { id, userId: session.user.id },
  });
  return NextResponse.json({ success: true });
}
