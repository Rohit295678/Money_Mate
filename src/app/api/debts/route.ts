import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const debts = db
    .prepare("SELECT * FROM debts WHERE user_id = ? ORDER BY created_at DESC")
    .all(session.user.id) as Record<string, unknown>[];

  const result = debts.map((d) => ({
    ...d,
    payments: db
      .prepare("SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC LIMIT 3")
      .all(d.id as string),
  }));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, totalAmount, interestRate, minimumPayment, dueDate } = await req.json();
  if (!name || !totalAmount)
    return NextResponse.json({ error: "Name and total amount required" }, { status: 400 });

  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO debts (id, user_id, name, total_amount, interest_rate, minimum_payment, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, session.user.id, name, Number(totalAmount), Number(interestRate ?? 0), Number(minimumPayment ?? 0), dueDate ?? null);

  const debt = db.prepare("SELECT * FROM debts WHERE id = ?").get(id);
  return NextResponse.json(debt, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { debtId, amount } = await req.json();
  if (!debtId || !amount)
    return NextResponse.json({ error: "Debt ID and amount required" }, { status: 400 });

  const db = getDb();
  const debt = db
    .prepare("SELECT * FROM debts WHERE id = ? AND user_id = ?")
    .get(debtId, session.user.id);
  if (!debt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pid = randomUUID();
  db.prepare("INSERT INTO debt_payments (id, debt_id, amount) VALUES (?, ?, ?)").run(pid, debtId, Number(amount));
  db.prepare("UPDATE debts SET paid_amount = paid_amount + ? WHERE id = ?").run(Number(amount), debtId);

  const updated = db.prepare("SELECT * FROM debts WHERE id = ?").get(debtId);
  return NextResponse.json({ debt: updated });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM debts WHERE id = ? AND user_id = ?").run(id, session.user.id);
  return NextResponse.json({ success: true });
}
