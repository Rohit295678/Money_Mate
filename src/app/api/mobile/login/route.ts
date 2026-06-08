import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signMobileToken } from "@/lib/mobile-jwt";
import { corsPreflight, jsonResponse } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonResponse({ error: "Email and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return jsonResponse({ error: "Invalid email or password" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return jsonResponse({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = signMobileToken({ sub: user.id, email: user.email });
  return jsonResponse({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
