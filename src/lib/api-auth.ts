import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-jwt";

// CORS: the mobile app calls this server from a different origin (none, in
// React Native — its `Origin` is `null` or `file://`). The simplest safe
// posture is "allow any origin" for /api/* since auth is per-request via
// either cookie or bearer token (i.e. CORS isn't doing security work here).
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function corsHeaders(): Record<string, string> {
  return { ...CORS_HEADERS };
}

export function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

// JSON helper that always includes CORS headers.
export function jsonResponse(body: unknown, init?: ResponseInit): NextResponse {
  return withCors(NextResponse.json(body, init));
}

export function unauthorized(): NextResponse {
  return jsonResponse({ error: "Unauthorized" }, { status: 401 });
}

// Standard preflight responder for OPTIONS.
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Resolve the current user id from EITHER:
//   1. an Authorization: Bearer <jwt> header (mobile app), OR
//   2. NextAuth's cookie session (web app)
// Returns null if neither is valid.
export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const payload = verifyMobileToken(token);
      if (payload) return payload.sub;
    }
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  return null;
}
