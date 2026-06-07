import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const db = getDb();
  let expenses;
  if (month && year) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(Number(year), Number(month), 0);
    const end = `${year}-${String(month).padStart(2, "0")}-${endDate.getDate()}`;
    expenses = db
      .prepare("SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC")
      .all(session.user.id, start, end + " 23:59:59");
  } else {
    expenses = db
      .prepare("SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC")
      .all(session.user.id);
  }
  return NextResponse.json(expenses);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, category, description, date } = await req.json();
  if (!amount || !category)
    return NextResponse.json({ error: "Amount and category required" }, { status: 400 });

  const db = getDb();
  const id = randomUUID();
  const expDate = date ? date : new Date().toISOString().split("T")[0];
  db.prepare(
    "INSERT INTO expenses (id, user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, session.user.id, Number(amount), category, description ?? null, expDate);

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM expenses WHERE id = ? AND user_id = ?").run(id, session.user.id);
  return NextResponse.json({ success: true });
}
