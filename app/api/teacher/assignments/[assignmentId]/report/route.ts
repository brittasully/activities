import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    assignmentId: string;
  };
};

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: params.assignmentId,
      class: {
        teacherId: auth.session.user.id,
      },
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      startAt: true,
      class: {
        select: {
          id: true,
          name: true,
          classStudents: {
            orderBy: {
              student: {
                name: "asc",
              },
            },
            select: {
              studentId: true,
              student: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      activityVersion: {
        select: {
          id: true,
          versionNumber: true,
          activity: {
            select: {
              title: true,
            },
          },
        },
      },
      submissions: {
        select: {
          id: true,
          studentId: true,
          status: true,
          score: true,
          maxScore: true,
          startedAt: true,
          completedAt: true,
          lastActiveAt: true,
        },
      },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const submissionByStudentId = new Map(assignment.submissions.map((submission) => [submission.studentId, submission]));

  const roster = assignment.class.classStudents.map((classStudent) => ({
    studentId: classStudent.studentId,
    name: classStudent.student.name,
  }));

  const statusOrder: Record<string, number> = {
    in_progress: 0,
    not_started: 1,
    completed: 2,
    reviewed: 3,
    needs_revision: 4,
    submitted: 5,
  };

  const progress = roster
    .map((student) => {
      const submission = submissionByStudentId.get(student.studentId);
      return {
        studentId: student.studentId,
        studentName: student.name,
        submissionId: submission?.id ?? null,
        status: submission?.status ?? "not_started",
        score: submission?.score ?? null,
        maxScore: submission?.maxScore ?? null,
        startedAt: submission?.startedAt ?? null,
        completedAt: submission?.completedAt ?? null,
        lastActiveAt: submission?.lastActiveAt ?? null,
      };
    })
    .sort((a, b) => {
      const statusDelta = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (statusDelta !== 0) return statusDelta;

      const aActive = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const bActive = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      if (aActive !== bActive) return bActive - aActive;

      return a.studentName.localeCompare(b.studentName);
    });

  return NextResponse.json({
    assignment: {
      id: assignment.id,
      title: assignment.title,
      dueAt: assignment.dueAt,
      startAt: assignment.startAt,
    },
    class: {
      id: assignment.class.id,
      name: assignment.class.name,
    },
    activity: {
      title: assignment.activityVersion.activity.title,
    },
    activityVersion: {
      id: assignment.activityVersion.id,
      versionNumber: assignment.activityVersion.versionNumber,
    },
    roster,
    submissions: assignment.submissions,
    progress,
  });
}
