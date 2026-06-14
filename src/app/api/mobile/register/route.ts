import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signMobileToken } from "@/lib/mobile-jwt";
import { corsPreflight, jsonResponse } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request) {
  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonResponse({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 6) {
    return jsonResponse({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonResponse({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: name || null, email, password: hashed },
    select: { id: true, name: true, email: true, upiId: true },
  });

  const token = signMobileToken({ sub: user.id, email: user.email });
  return jsonResponse({ token, user }, { status: 201 });
}
