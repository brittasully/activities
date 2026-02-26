import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { CurrentSession } from "@/lib/auth/session";
import { getCurrentSession } from "@/lib/auth/session";

type AuthFailure = {
  ok: false;
  error: NextResponse;
};

type AuthSuccess = {
  ok: true;
  session: CurrentSession;
};

export async function requireApiRole(role: UserRole): Promise<AuthFailure | AuthSuccess> {
  const session = await getCurrentSession();

  if (!session || session.role !== role) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, session };
}
