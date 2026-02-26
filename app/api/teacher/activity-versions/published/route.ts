import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const activityVersions = await prisma.activityVersion.findMany({
    where: {
      publishedAt: { not: null },
      activity: { teacherId: auth.session.user.id },
    },
    orderBy: [{ activity: { title: "asc" } }, { versionNumber: "desc" }],
    select: {
      id: true,
      versionNumber: true,
      publishedAt: true,
      activity: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return NextResponse.json({ activityVersions });
}
