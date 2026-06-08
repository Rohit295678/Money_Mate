import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debts = await prisma.debt.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      payments: {
        orderBy: { date: "desc" },
        take: 3,
      },
    },
  });
  return NextResponse.json(debts);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, totalAmount, interestRate, minimumPayment, dueDate } = await req.json();
  if (!name || !totalAmount)
    return NextResponse.json({ error: "Name and total amount required" }, { status: 400 });

  const debt = await prisma.debt.create({
    data: {
      userId: session.user.id,
      name,
      totalAmount: Number(totalAmount),
      interestRate: Number(interestRate ?? 0),
      minimumPayment: Number(minimumPayment ?? 0),
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  return NextResponse.json(debt, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { debtId, amount } = await req.json();
  if (!debtId || !amount)
    return NextResponse.json({ error: "Debt ID and amount required" }, { status: 400 });

  const owned = await prisma.debt.findFirst({
    where: { id: debtId, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [, updated] = await prisma.$transaction([
    prisma.debtPayment.create({
      data: { debtId, amount: Number(amount) },
    }),
    prisma.debt.update({
      where: { id: debtId },
      data: { paidAmount: { increment: Number(amount) } },
    }),
  ]);

  return NextResponse.json({ debt: updated });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.debt.deleteMany({
    where: { id, userId: session.user.id },
  });
  return NextResponse.json({ success: true });
}
