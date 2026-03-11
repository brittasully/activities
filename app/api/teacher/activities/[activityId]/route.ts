import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    activityId: string;
  };
};

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const activity = await prisma.activity.findFirst({
    where: {
      id: params.activityId,
      teacherId: auth.session.user.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      templateType: true,
      status: true,
      draftConfigJson: true,
      createdAt: true,
      updatedAt: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          publishedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  return NextResponse.json({ activity });
}
