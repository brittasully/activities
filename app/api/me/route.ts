import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ user: null, role: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    role: session.role,
  });
}
