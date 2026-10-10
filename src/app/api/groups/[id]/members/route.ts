import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";
import { notifyInvitees } from "@/lib/email";
import { groupInviteMessage, nameOf, notify } from "@/lib/notify";

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
// Instead of adding directly, this now sends an invitation the user must accept.
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
    select: { id: true, name: true, email: true },
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

  const [group, inviter] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ]);

  // Upsert the invitation: a previously declined one is flipped back to pending.
  const invitation = await prisma.groupInvitation.upsert({
    where: { groupId_inviteeId: { groupId, inviteeId: user.id } },
    update: { status: "pending", inviterId: userId, respondedAt: null },
    create: { groupId, inviteeId: user.id, inviterId: userId },
    select: { id: true, status: true },
  });

  await notifyInvitees(inviter?.name ?? null, group?.name ?? "a group", [user.email]);
  notify([
    groupInviteMessage(user.id, nameOf(inviter), { id: groupId, name: group?.name ?? "a group" }),
  ]);

  return jsonResponse(
    {
      invited: true,
      invitation: {
        id: invitation.id,
        user_id: user.id,
        name: user.name ?? user.email.split("@")[0],
        email: user.email,
        status: invitation.status,
      },
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

  // Leaving a group yourself isn't news to you; being removed by someone is.
  if (target.userId !== userId) {
    const [groupInfo, actor] = await Promise.all([
      prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    ]);
    notify([
      {
        userId: target.userId,
        type: "member_removed",
        title: "Removed from group",
        body: `${nameOf(actor)} removed you from "${groupInfo?.name ?? "a group"}".`,
        groupId,
      },
    ]);
  }
  return jsonResponse({ success: true });
}
