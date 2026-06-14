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
    select: { id: true, name: true, email: true, upiId: true, image: true },
  });
  if (!user) return unauthorized();

  return jsonResponse({ user });
}

// PATCH /api/mobile/me  body: { upiId?: string | null, name?: string }
// Lets mobile clients update editable profile fields.
export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const data: { upiId?: string | null; name?: string } = {};

  if ("upiId" in body) {
    const raw = body.upiId;
    if (raw === null || raw === "") {
      data.upiId = null;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      // VPA format: <handle>@<provider>, e.g. rohit@upi, 9999999999@ybl.
      // Mirror the same regex on the client so users get instant feedback.
      const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;
      if (!VPA_RE.test(trimmed)) {
        return jsonResponse(
          { error: "Invalid UPI ID. Expected format like name@bank." },
          { status: 400 }
        );
      }
      data.upiId = trimmed;
    } else {
      return jsonResponse({ error: "upiId must be a string or null" }, { status: 400 });
    }
  }

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      return jsonResponse({ error: "name cannot be empty" }, { status: 400 });
    }
    data.name = trimmed;
  }

  if (Object.keys(data).length === 0) {
    return jsonResponse({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, upiId: true, image: true },
  });

  return jsonResponse({ user });
}
