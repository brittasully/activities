import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth/session";

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      role: UserRole.teacher,
      name,
      email,
      passwordHash,
    },
  });

  const { token, expiresAt } = await createSession(user.id, UserRole.teacher);
  const response = NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } }, { status: 201 });
  setSessionCookie(response, token, expiresAt);

  return response;
}
