import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const classes = await prisma.class.findMany({
    where: { teacherId: auth.session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      gradeBand: true,
      accessCode: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ classes });
}
