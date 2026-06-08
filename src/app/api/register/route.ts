import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { corsPreflight, jsonResponse } from "@/lib/api-auth";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  if (!email || !password)
    return jsonResponse({ error: "Email and password required" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return jsonResponse({ error: "Email already in use" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: name ?? null, email, password: hashed },
    select: { id: true, email: true },
  });

  return jsonResponse(user, { status: 201 });
}
