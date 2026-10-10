import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

const PAGE_SIZE = 50;

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/notifications — latest notifications + unread count for the bell badge.
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return jsonResponse({
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      group_id: n.groupId,
      read: n.read,
      created_at: n.createdAt,
    })),
  });
}

// PATCH /api/notifications  body: { ids?: string[] }
// Marks the given notifications read, or ALL of them when `ids` is omitted.
export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : undefined;

  await prisma.notification.updateMany({
    where: { userId, read: false, ...(ids ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
  return jsonResponse({ success: true });
}
