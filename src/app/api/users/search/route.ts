import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/users/search?q=ali  -> [{ id, name, email }, ...]
// Used to populate the "add member" dropdown when creating/editing a group.
// Excludes the requesting user (UI layer adds them automatically).
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return jsonResponse([]);

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: userId } },
        {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true, upiId: true },
    take: 10,
    orderBy: { email: "asc" },
  });

  // Surface the snake_case `upi_id` to match the rest of the API contract.
  return jsonResponse(users.map((u) => ({ id: u.id, name: u.name, email: u.email, upi_id: u.upiId })));
}
