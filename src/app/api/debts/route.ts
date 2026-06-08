import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const debts = await prisma.debt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      payments: {
        orderBy: { date: "desc" },
        take: 3,
      },
    },
  });
  return jsonResponse(debts);
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { name, totalAmount, interestRate, minimumPayment, dueDate } = await req.json();
  if (!name || !totalAmount)
    return jsonResponse({ error: "Name and total amount required" }, { status: 400 });

  const debt = await prisma.debt.create({
    data: {
      userId,
      name,
      totalAmount: Number(totalAmount),
      interestRate: Number(interestRate ?? 0),
      minimumPayment: Number(minimumPayment ?? 0),
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  return jsonResponse(debt, { status: 201 });
}

export async function PUT(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { debtId, amount } = await req.json();
  if (!debtId || !amount)
    return jsonResponse({ error: "Debt ID and amount required" }, { status: 400 });

  const owned = await prisma.debt.findFirst({
    where: { id: debtId, userId },
    select: { id: true },
  });
  if (!owned) return jsonResponse({ error: "Not found" }, { status: 404 });

  const [, updated] = await prisma.$transaction([
    prisma.debtPayment.create({
      data: { debtId, amount: Number(amount) },
    }),
    prisma.debt.update({
      where: { id: debtId },
      data: { paidAmount: { increment: Number(amount) } },
    }),
  ]);

  return jsonResponse({ debt: updated });
}

export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return jsonResponse({ error: "ID required" }, { status: 400 });

  await prisma.debt.deleteMany({ where: { id, userId } });
  return jsonResponse({ success: true });
}
