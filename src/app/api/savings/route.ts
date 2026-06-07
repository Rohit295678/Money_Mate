import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const goals = db
    .prepare("SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC")
    .all(session.user.id) as Record<string, unknown>[];

  const result = goals.map((g) => ({
    ...g,
    contributions: db
      .prepare("SELECT * FROM savings_contributions WHERE goal_id = ? ORDER BY date DESC LIMIT 5")
      .all(g.id as string),
  }));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, targetAmount, deadline } = await req.json();
  if (!name || !targetAmount)
    return NextResponse.json({ error: "Name and target required" }, { status: 400 });

  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO savings_goals (id, user_id, name, target_amount, deadline) VALUES (?, ?, ?, ?, ?)"
  ).run(id, session.user.id, name, Number(targetAmount), deadline ?? null);

  const goal = db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(id);
  return NextResponse.json(goal, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId, amount, note } = await req.json();
  if (!goalId || !amount)
    return NextResponse.json({ error: "Goal ID and amount required" }, { status: 400 });

  const db = getDb();
  const goal = db
    .prepare("SELECT * FROM savings_goals WHERE id = ? AND user_id = ?")
    .get(goalId, session.user.id);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cid = randomUUID();
  db.prepare(
    "INSERT INTO savings_contributions (id, goal_id, amount, note) VALUES (?, ?, ?, ?)"
  ).run(cid, goalId, Number(amount), note ?? null);
  db.prepare(
    "UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?"
  ).run(Number(amount), goalId);

  const updated = db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(goalId);
  return NextResponse.json({ goal: updated });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM savings_goals WHERE id = ? AND user_id = ?").run(id, session.user.id);
  return NextResponse.json({ success: true });
}
