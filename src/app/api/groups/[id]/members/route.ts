import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function assertGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
}

// POST /api/groups/[id]/members  body: { email: "alice@example.com" }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const { email } = await req.json();
  if (typeof email !== "string" || !email.trim())
    return NextResponse.json({ error: "email required" }, { status: 400 });

  const me = await assertGroupMember(groupId, session.user.id);
  if (!me) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const target = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: target, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!user)
    return NextResponse.json(
      { error: `No registered user found for ${target}` },
      { status: 404 }
    );

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
    select: { id: true },
  });
  if (existing)
    return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const member = await prisma.groupMember.create({
    data: { groupId, userId: user.id },
  });
  return NextResponse.json(
    {
      id: member.id,
      user_id: user.id,
      name: user.name ?? user.email.split("@")[0],
      email: user.email,
    },
    { status: 201 }
  );
}

// DELETE /api/groups/[id]/members?memberId=...  removes that GroupMember row.
// Allowed for any member of the group. Owner cannot be removed (delete the group instead).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  if (!memberId)
    return NextResponse.json({ error: "memberId required" }, { status: 400 });

  const me = await assertGroupMember(groupId, session.user.id);
  if (!me) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { userId: true },
  });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const target = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId },
    select: { id: true, userId: true },
  });
  if (!target)
    return NextResponse.json({ error: "Member not in this group" }, { status: 404 });

  if (target.userId === group.userId)
    return NextResponse.json(
      { error: "Cannot remove the group owner; delete the group instead" },
      { status: 400 }
    );

  await prisma.groupMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
