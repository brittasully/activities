import { SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  status: z.enum([SubmissionStatus.reviewed, SubmissionStatus.needs_revision, SubmissionStatus.completed]),
});

type RouteContext = {
  params: {
    submissionId: string;
  };
};

export async function POST(req: Request, { params }: RouteContext) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

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
      startedAt: true,
      completedAt: true,
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const now = new Date();
  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === SubmissionStatus.completed ? submission.completedAt ?? now : submission.completedAt,
      startedAt: submission.startedAt ?? now,
      lastActiveAt: now,
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
      lastActiveAt: true,
    },
  });

  return NextResponse.json({ submission: updated });
}
