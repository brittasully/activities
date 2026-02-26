import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("student");
  if (!auth.ok) return auth.error;

  const assignments = await prisma.assignment.findMany({
    where: {
      class: {
        classStudents: {
          some: {
            studentId: auth.session.user.id,
          },
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      class: {
        select: {
          id: true,
          name: true,
        },
      },
      submissions: {
        where: { studentId: auth.session.user.id },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      dueAt: assignment.dueAt,
      class: assignment.class,
      status: assignment.submissions[0]?.status ?? "not_started",
      submissionId: assignment.submissions[0]?.id ?? null,
    })),
  });
}
