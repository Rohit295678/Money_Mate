import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const groups = db
    .prepare("SELECT * FROM bill_groups WHERE user_id = ? ORDER BY created_at DESC")
    .all(session.user.id) as Record<string, unknown>[];

  const result = groups.map((g) => {
    const members = db.prepare("SELECT * FROM members WHERE group_id = ?").all(g.id as string);
    const bills = (
      db.prepare("SELECT * FROM bills WHERE group_id = ? ORDER BY date DESC").all(g.id as string) as Record<string, unknown>[]
    ).map((b) => ({
      ...b,
      paidBy: db.prepare("SELECT * FROM members WHERE id = ?").get(b.member_id as string),
      splits: (
        db.prepare("SELECT * FROM bill_splits WHERE bill_id = ?").all(b.id as string) as Record<string, unknown>[]
      ).map((s) => ({
        ...s,
        settled: Boolean(s.settled),
        member: db.prepare("SELECT * FROM members WHERE id = ?").get(s.member_id as string),
      })),
    }));
    return { ...g, members, bills };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, members } = await req.json();
  if (!name) return NextResponse.json({ error: "Group name required" }, { status: 400 });

  const db = getDb();
  const groupId = randomUUID();
  db.prepare("INSERT INTO bill_groups (id, user_id, name) VALUES (?, ?, ?)").run(groupId, session.user.id, name);

  const insertMember = db.prepare("INSERT INTO members (id, group_id, name, email) VALUES (?, ?, ?, ?)");
  for (const m of (members as { name: string; email?: string }[])) {
    insertMember.run(randomUUID(), groupId, m.name, m.email ?? null);
  }

  const group = db.prepare("SELECT * FROM bill_groups WHERE id = ?").get(groupId);
  const memberRows = db.prepare("SELECT * FROM members WHERE group_id = ?").all(groupId);
  return NextResponse.json({ ...group, members: memberRows, bills: [] }, { status: 201 });
}
