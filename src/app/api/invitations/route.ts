import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";
import { nameOf, notify } from "@/lib/notify";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/invitations — pending invitations addressed to the current user.
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const invites = await prisma.groupInvitation.findMany({
    where: { inviteeId: userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    include: {
      group: { select: { id: true, name: true } },
      inviter: { select: { id: true, name: true, email: true } },
    },
  });

  return jsonResponse(
    invites.map((i) => ({
      id: i.id,
      group_id: i.group.id,
      group_name: i.group.name,
      inviter_name: i.inviter.name ?? i.inviter.email.split("@")[0],
      created_at: i.createdAt,
    }))
  );
}

// POST /api/invitations  body: { id: string, action: "accept" | "decline" }
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id, action } = await req.json();
  if (typeof id !== "string" || (action !== "accept" && action !== "decline"))
    return jsonResponse({ error: "id and action ('accept'|'decline') required" }, { status: 400 });

  // Must be a pending invite addressed to this user.
  const invite = await prisma.groupInvitation.findFirst({
    where: { id, inviteeId: userId, status: "pending" },
    select: {
      id: true,
      groupId: true,
      inviterId: true,
      group: { select: { name: true } },
      invitee: { select: { name: true, email: true } },
    },
  });
  if (!invite) return jsonResponse({ error: "Invitation not found" }, { status: 404 });

  if (action === "decline") {
    await prisma.groupInvitation.update({
      where: { id: invite.id },
      data: { status: "declined", respondedAt: new Date() },
    });
    return jsonResponse({ success: true, status: "declined" });
  }

  // Accept: add the membership (idempotent) and mark the invite accepted.
  await prisma.$transaction([
    prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: invite.groupId, userId } },
      update: {},
      create: { groupId: invite.groupId, userId },
    }),
    prisma.groupInvitation.update({
      where: { id: invite.id },
      data: { status: "accepted", respondedAt: new Date() },
    }),
  ]);

  notify([
    {
      userId: invite.inviterId,
      type: "invite_accepted",
      title: "Invite accepted",
      body: `${nameOf(invite.invitee)} joined "${invite.group.name}".`,
      groupId: invite.groupId,
    },
  ]);
  return jsonResponse({ success: true, status: "accepted", group_id: invite.groupId });
}
