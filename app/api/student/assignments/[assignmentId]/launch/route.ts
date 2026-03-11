import { SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { mintLaunchToken } from "@/lib/auth/launch-token";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    assignmentId: string;
  };
};

export async function POST(_req: Request, { params }: RouteContext) {
  const auth = await requireApiRole("student");
  if (!auth.ok) return auth.error;

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: params.assignmentId,
      class: {
        classStudents: {
          some: { studentId: auth.session.user.id },
        },
      },
      activityVersion: {
        publishedAt: { not: null },
      },
    },
    include: {
      activityVersion: {
        select: {
          id: true,
          bundleKey: true,
          entryPath: true,
          manifestJson: true,
          publishedAt: true,
        },
      },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found or activity version is unpublished" }, { status: 404 });
  }

  const now = new Date();
  const submission = await prisma.$transaction(async (tx) => {
    const existing = await tx.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: auth.session.user.id,
        },
      },
    });

    if (!existing) {
      return tx.submission.create({
        data: {
          assignmentId: assignment.id,
          studentId: auth.session.user.id,
          status: SubmissionStatus.in_progress,
          startedAt: now,
          lastActiveAt: now,
        },
      });
    }

    const nextStatus = existing.status === SubmissionStatus.not_started ? SubmissionStatus.in_progress : existing.status;

    return tx.submission.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        startedAt: existing.startedAt ?? now,
        lastActiveAt: now,
      },
    });
  });

  const launchToken = mintLaunchToken({
    assignmentId: assignment.id,
    studentId: auth.session.user.id,
    activityVersionId: assignment.activityVersionId,
  });

  return NextResponse.json({
    submissionId: submission.id,
    launchToken,
    activityVersion: assignment.activityVersion,
  });
}
