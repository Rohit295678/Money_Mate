import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());

  const db = getDb();
  const budgets = db
    .prepare("SELECT * FROM budgets WHERE user_id = ? AND month = ? AND year = ?")
    .all(session.user.id, month, year);
  return NextResponse.json(budgets);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, limit, month, year } = await req.json();
  const m = month ?? new Date().getMonth() + 1;
  const y = year ?? new Date().getFullYear();

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ?")
    .get(session.user.id, category, m, y) as { id: string } | undefined;

  if (existing) {
    db.prepare("UPDATE budgets SET limit_amount = ? WHERE id = ?").run(Number(limit), existing.id);
    const updated = db.prepare("SELECT * FROM budgets WHERE id = ?").get(existing.id);
    return NextResponse.json(updated);
  }

  const id = randomUUID();
  db.prepare(
    "INSERT INTO budgets (id, user_id, category, limit_amount, month, year) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, session.user.id, category, Number(limit), m, y);
  const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
  return NextResponse.json(budget);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM budgets WHERE id = ? AND user_id = ?").run(id, session.user.id);
  return NextResponse.json({ success: true });
}
