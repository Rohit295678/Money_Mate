import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";
import { signMobileToken } from "@/lib/mobile-jwt";
import { corsPreflight, jsonResponse } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

// We accept either Android or web client IDs as audience values when verifying
// the Google ID token. Set both as comma-separated env vars so a single token
// from any of our OAuth clients passes verification.
//
//   GOOGLE_CLIENT_ID         — primary (web; used by NextAuth too)
//   GOOGLE_CLIENT_ID_ANDROID — used by the Android app's GoogleSignIn module
//   GOOGLE_CLIENT_ID_IOS     — reserved for future iOS support
function allowedAudiences(): string[] {
  const ids = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
  ];
  return ids.filter((x): x is string => !!x && x.length > 0);
}

const verifierClient = new OAuth2Client();

interface GooglePayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

async function verifyGoogleIdToken(idToken: string): Promise<GooglePayload | null> {
  const audiences = allowedAudiences();
  if (audiences.length === 0) {
    return null;
  }
  try {
    const ticket = await verifierClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified ?? false,
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

// POST /api/mobile/google  body: { idToken: "..." }
//
// Mobile clients hand us a Google ID token (a JWT signed by Google). We verify
// it, then either find or create a MoneyMate user keyed first by googleId,
// then by email, and return our own JWT.
export async function POST(req: Request) {
  if (allowedAudiences().length === 0) {
    return jsonResponse(
      {
        error:
          "Google sign-in is not configured on the server. Ask the admin to set GOOGLE_CLIENT_ID.",
      },
      { status: 503 }
    );
  }

  let body: { idToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    return jsonResponse({ error: "idToken required" }, { status: 400 });
  }

  const payload = await verifyGoogleIdToken(idToken);
  if (!payload) {
    return jsonResponse({ error: "Invalid Google token" }, { status: 401 });
  }

  const { sub: googleSub, email: rawEmail, name = null, picture = null } = payload;
  const email = rawEmail?.trim().toLowerCase();
  if (!email) {
    return jsonResponse(
      { error: "Google account did not return an email" },
      { status: 400 }
    );
  }

  // Look up by googleId first (most stable), then by email.
  let user = await prisma.user.findUnique({ where: { googleId: googleSub } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Auto-link existing email user with their Google identity.
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleSub,
          image: user.image ?? picture,
          name: user.name ?? name,
        },
      });
    }
  }
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        image: picture,
        googleId: googleSub,
        password: null,
      },
    });
  }

  const token = signMobileToken({ sub: user.id, email: user.email });
  return jsonResponse({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      upiId: user.upiId,
      image: user.image,
    },
  });
}
