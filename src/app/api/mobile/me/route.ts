import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

// Lightweight endpoint mobile clients can call on launch to confirm the
// stored token is still valid and to refresh basic profile info.
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return unauthorized();

  return jsonResponse({ user });
}
