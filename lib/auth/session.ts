import { randomBytes } from "crypto";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const sessionCookieName = env.SESSION_COOKIE_NAME;

export type CurrentSession = {
  token: string;
  role: UserRole;
  user: {
    id: string;
    name: string;
    email: string | null;
  };
};

export async function createSession(userId: string, role: UserRole) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      token,
      userId,
      role,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookieAndRecord(response: NextResponse) {
  const token = cookies().get(sessionCookieName)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const token = cookies().get(sessionCookieName)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return {
    token,
    role: session.role,
    user: session.user,
  };
}
