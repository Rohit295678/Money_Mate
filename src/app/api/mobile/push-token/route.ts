import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

// Expo push tokens look like ExponentPushToken[xxxxxxxx] (or ExpoPushToken[...]).
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export async function OPTIONS() {
  return corsPreflight();
}

// POST /api/mobile/push-token  body: { token, platform? }
// Idempotent: the same device re-registering (or switching accounts) just
// re-points the existing row at the current user.
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!EXPO_TOKEN_RE.test(token))
    return jsonResponse({ error: "Invalid Expo push token" }, { status: 400 });
  const platform =
    body.platform === "android" || body.platform === "ios" ? body.platform : null;

  await prisma.pushToken.upsert({
    where: { token },
    update: { userId, platform },
    create: { userId, token, platform },
  });
  return jsonResponse({ success: true });
}

// DELETE /api/mobile/push-token?token=...  called on sign-out so the device
// stops receiving pushes for this account.
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return jsonResponse({ error: "token required" }, { status: 400 });

  await prisma.pushToken.deleteMany({ where: { token, userId } });
  return jsonResponse({ success: true });
}
