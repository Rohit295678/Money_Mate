import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  if (!email || !password)
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const id = randomUUID();
  db.prepare("INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)").run(id, name ?? null, email, hashed);

  return NextResponse.json({ id, email }, { status: 201 });
}
