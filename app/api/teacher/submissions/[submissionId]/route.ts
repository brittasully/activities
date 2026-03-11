import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    submissionId: string;
  };
};

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const submission = await prisma.submission.findFirst({
    where: {
      id: params.submissionId,
      assignment: {
        class: {
          teacherId: auth.session.user.id,
        },
      },
    },
    select: {
      id: true,
      status: true,
      score: true,
      maxScore: true,
      startedAt: true,
      completedAt: true,
      lastActiveAt: true,
      latestStateJson: true,
      student: {
        select: {
          id: true,
          name: true,
        },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      submissionEvents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          payloadJson: true,
          createdAt: true,
        },
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          storageUrl: true,
          filename: true,
          mimeType: true,
          createdAt: true,
        },
      },
      feedback: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          commentText: true,
          statusUpdate: true,
          createdAt: true,
          teacher: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json({ submission });
}
