import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      contributions: {
        orderBy: { date: "desc" },
        take: 5,
      },
    },
  });
  return jsonResponse(goals);
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { name, targetAmount, deadline } = await req.json();
  if (!name || !targetAmount)
    return jsonResponse({ error: "Name and target required" }, { status: 400 });

  const goal = await prisma.savingsGoal.create({
    data: {
      userId,
      name,
      targetAmount: Number(targetAmount),
      deadline: deadline ? new Date(deadline) : null,
    },
  });
  return jsonResponse(goal, { status: 201 });
}

export async function PUT(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { goalId, amount, note } = await req.json();
  if (!goalId || !amount)
    return jsonResponse({ error: "Goal ID and amount required" }, { status: 400 });

  const owned = await prisma.savingsGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  if (!owned) return jsonResponse({ error: "Not found" }, { status: 404 });

  const [, updated] = await prisma.$transaction([
    prisma.savingsContribution.create({
      data: { goalId, amount: Number(amount), note: note ?? null },
    }),
    prisma.savingsGoal.update({
      where: { id: goalId },
      data: { currentAmount: { increment: Number(amount) } },
    }),
  ]);

  return jsonResponse({ goal: updated });
}

export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return jsonResponse({ error: "ID required" }, { status: 400 });

  await prisma.savingsGoal.deleteMany({ where: { id, userId } });
  return jsonResponse({ success: true });
}
