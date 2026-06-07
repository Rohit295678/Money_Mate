import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const { title, amount, memberId } = await req.json();

  const db = getDb();
  const group = db
    .prepare("SELECT * FROM bill_groups WHERE id = ? AND user_id = ?")
    .get(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const members = db
    .prepare("SELECT * FROM members WHERE group_id = ?")
    .all(groupId) as { id: string }[];

  const perPerson = Number(amount) / members.length;
  const billId = randomUUID();
  db.prepare(
    "INSERT INTO bills (id, group_id, member_id, title, amount) VALUES (?, ?, ?, ?, ?)"
  ).run(billId, groupId, memberId, title, Number(amount));

  const insertSplit = db.prepare(
    "INSERT INTO bill_splits (id, bill_id, member_id, amount, settled) VALUES (?, ?, ?, ?, ?)"
  );
  for (const m of members) {
    insertSplit.run(randomUUID(), billId, m.id, perPerson, m.id === memberId ? 1 : 0);
  }

  const bill = db.prepare("SELECT * FROM bills WHERE id = ?").get(billId) as Record<string, unknown>;
  const paidBy = db.prepare("SELECT * FROM members WHERE id = ?").get(memberId);
  const splits = (
    db.prepare("SELECT * FROM bill_splits WHERE bill_id = ?").all(billId) as Record<string, unknown>[]
  ).map((s) => ({
    ...s,
    settled: Boolean(s.settled),
    member: db.prepare("SELECT * FROM members WHERE id = ?").get(s.member_id as string),
  }));

  return NextResponse.json({ ...bill, paidBy, splits }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const { splitId } = await req.json();

  const db = getDb();
  const split = db
    .prepare(
      "SELECT bs.* FROM bill_splits bs JOIN bills b ON bs.bill_id = b.id WHERE bs.id = ? AND b.group_id = ?"
    )
    .get(splitId, groupId);
  if (!split) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE bill_splits SET settled = 1 WHERE id = ?").run(splitId);
  return NextResponse.json({ success: true });
}
