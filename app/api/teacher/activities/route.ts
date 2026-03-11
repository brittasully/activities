import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const activities = await prisma.activity.findMany({
    where: { teacherId: auth.session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      templateType: true,
      status: true,
      updatedAt: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          publishedAt: true,
        },
      },
    },
  });

  return NextResponse.json({ activities });
}
