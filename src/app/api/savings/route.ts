import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.savingsGoal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      contributions: {
        orderBy: { date: "desc" },
        take: 5,
      },
    },
  });
  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, targetAmount, deadline } = await req.json();
  if (!name || !targetAmount)
    return NextResponse.json({ error: "Name and target required" }, { status: 400 });

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: session.user.id,
      name,
      targetAmount: Number(targetAmount),
      deadline: deadline ? new Date(deadline) : null,
    },
  });
  return NextResponse.json(goal, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId, amount, note } = await req.json();
  if (!goalId || !amount)
    return NextResponse.json({ error: "Goal ID and amount required" }, { status: 400 });

  const owned = await prisma.savingsGoal.findFirst({
    where: { id: goalId, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [, updated] = await prisma.$transaction([
    prisma.savingsContribution.create({
      data: { goalId, amount: Number(amount), note: note ?? null },
    }),
    prisma.savingsGoal.update({
      where: { id: goalId },
      data: { currentAmount: { increment: Number(amount) } },
    }),
  ]);

  return NextResponse.json({ goal: updated });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.savingsGoal.deleteMany({
    where: { id, userId: session.user.id },
  });
  return NextResponse.json({ success: true });
}
