import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RawMember = {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: Date;
  user: { id: string; name: string | null; email: string };
};

type RawSplit = {
  id: string;
  billId: string;
  memberId: string;
  amount: number;
  settled: boolean;
  member: RawMember;
};

type RawBill = {
  id: string;
  groupId: string;
  memberId: string;
  title: string;
  amount: number;
  date: Date;
  paidBy: RawMember;
  splits: RawSplit[];
};

// Flatten a GroupMember row into the `Member` shape the frontend already uses.
// Frontend expects: { id, name, email } where `id` is the GroupMember row id.
function flattenMember(m: RawMember) {
  return {
    id: m.id,
    user_id: m.userId,
    name: m.user.name ?? m.user.email.split("@")[0],
    email: m.user.email,
  };
}

function flattenBill(b: RawBill) {
  return {
    id: b.id,
    group_id: b.groupId,
    member_id: b.memberId,
    title: b.title,
    amount: b.amount,
    date: b.date,
    paidBy: flattenMember(b.paidBy),
    splits: b.splits.map((s) => ({
      id: s.id,
      bill_id: s.billId,
      member_id: s.memberId,
      amount: s.amount,
      settled: s.settled,
      member: flattenMember(s.member),
    })),
  };
}

type RawSettlement = {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  note: string | null;
  date: Date;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return every group where the user has a GroupMember row.
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { createdAt: "desc" },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      bills: {
        orderBy: { date: "desc" },
        include: {
          paidBy: { include: { user: { select: { id: true, name: true, email: true } } } },
          splits: {
            include: {
              member: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
          },
        },
      },
      settlements: { orderBy: { date: "desc" } },
    },
  });

  const result = groups.map((g) => ({
    id: g.id,
    name: g.name,
    user_id: g.userId,
    created_at: g.createdAt,
    isOwner: g.userId === session.user.id,
    members: (g.members as unknown as RawMember[]).map(flattenMember),
    bills: (g.bills as unknown as RawBill[]).map(flattenBill),
    settlements: (g.settlements as unknown as RawSettlement[]).map((s) => ({
      id: s.id,
      from_member_id: s.fromMemberId,
      to_member_id: s.toMemberId,
      amount: s.amount,
      note: s.note,
      date: s.date,
    })),
  }));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name: string = body.name;
  const memberEmails: string[] = Array.isArray(body.memberEmails) ? body.memberEmails : [];

  if (!name?.trim()) return NextResponse.json({ error: "Group name required" }, { status: 400 });

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 401 });

  // Look up every requested email. Reject the whole request if any are unknown.
  const cleanEmails = Array.from(
    new Set(
      memberEmails
        .map((e) => e?.trim().toLowerCase())
        .filter((e): e is string => !!e && e !== me.email.toLowerCase())
    )
  );

  let foundUsers: { id: string; email: string }[] = [];
  if (cleanEmails.length > 0) {
    foundUsers = await prisma.user.findMany({
      where: { email: { in: cleanEmails, mode: "insensitive" } },
      select: { id: true, email: true },
    });
  }

  const foundLowercase = new Set(foundUsers.map((u) => u.email.toLowerCase()));
  const unknown = cleanEmails.filter((e) => !foundLowercase.has(e));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Not registered users: ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  // Creator is auto-included; dedupe just in case.
  const userIdsForGroup = Array.from(new Set([me.id, ...foundUsers.map((u) => u.id)]));

  const created = await prisma.group.create({
    data: {
      userId: me.id,
      name: name.trim(),
      members: {
        create: userIdsForGroup.map((uid) => ({ userId: uid })),
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      user_id: created.userId,
      created_at: created.createdAt,
      isOwner: true,
      members: (created.members as unknown as RawMember[]).map(flattenMember),
      bills: [],
    },
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Any member of the group can delete it (per app spec).
  const member = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: session.user.id },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
