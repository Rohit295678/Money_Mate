import jwt from "jsonwebtoken";

// Mobile clients (the React Native app) authenticate with their own JWT
// instead of NextAuth's cookie session. We sign these with NEXTAUTH_SECRET
// to avoid introducing a new env var.

const ISSUER = "moneymate-mobile";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type MobileTokenPayload = {
  sub: string; // user id
  email: string;
};

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }
  return secret;
}

export function signMobileToken(payload: MobileTokenPayload): string {
  return jwt.sign(payload, getSecret(), {
    issuer: ISSUER,
    expiresIn: TTL_SECONDS,
  });
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { issuer: ISSUER });
    if (typeof decoded === "string") return null;
    const sub = decoded.sub;
    const email = (decoded as jwt.JwtPayload & { email?: unknown }).email;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    return { sub, email };
  } catch {
    return null;
  }
}
