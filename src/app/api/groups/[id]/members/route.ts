import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

async function assertGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
}

export async function OPTIONS() {
  return corsPreflight();
}

// POST /api/groups/[id]/members  body: { email: "alice@example.com" }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id: groupId } = await params;
  const { email } = await req.json();
  if (typeof email !== "string" || !email.trim())
    return jsonResponse({ error: "email required" }, { status: 400 });

  const me = await assertGroupMember(groupId, userId);
  if (!me) return jsonResponse({ error: "Group not found" }, { status: 404 });

  const target = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: target, mode: "insensitive" } },
    select: { id: true, name: true, email: true, upiId: true },
  });
  if (!user)
    return jsonResponse(
      { error: `No registered user found for ${target}` },
      { status: 404 }
    );

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
    select: { id: true },
  });
  if (existing)
    return jsonResponse({ error: "Already a member" }, { status: 409 });

  const member = await prisma.groupMember.create({
    data: { groupId, userId: user.id },
  });
  return jsonResponse(
    {
      id: member.id,
      user_id: user.id,
      name: user.name ?? user.email.split("@")[0],
      email: user.email,
      upi_id: user.upiId,
    },
    { status: 201 }
  );
}

// DELETE /api/groups/[id]/members?memberId=...  removes that GroupMember row.
// Allowed for any member of the group. Owner cannot be removed (delete the group instead).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id: groupId } = await params;
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  if (!memberId)
    return jsonResponse({ error: "memberId required" }, { status: 400 });

  const me = await assertGroupMember(groupId, userId);
  if (!me) return jsonResponse({ error: "Group not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { userId: true },
  });
  if (!group) return jsonResponse({ error: "Group not found" }, { status: 404 });

  const target = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId },
    select: { id: true, userId: true },
  });
  if (!target)
    return jsonResponse({ error: "Member not in this group" }, { status: 404 });

  if (target.userId === group.userId)
    return jsonResponse(
      { error: "Cannot remove the group owner; delete the group instead" },
      { status: 400 }
    );

  await prisma.groupMember.delete({ where: { id: memberId } });
  return jsonResponse({ success: true });
}
