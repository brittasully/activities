import { SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

const feedbackSchema = z.object({
  commentText: z.string().trim().min(1),
  statusUpdate: z.enum([SubmissionStatus.reviewed, SubmissionStatus.needs_revision, SubmissionStatus.completed]).optional(),
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
  const parsed = feedbackSchema.safeParse(body);

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
      completedAt: true,
      startedAt: true,
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const feedback = await tx.feedback.create({
      data: {
        submissionId: submission.id,
        teacherId: auth.session.user.id,
        commentText: parsed.data.commentText,
        statusUpdate: parsed.data.statusUpdate,
      },
      select: {
        id: true,
        commentText: true,
        statusUpdate: true,
        createdAt: true,
      },
    });

    let updatedSubmission = null;

    if (parsed.data.statusUpdate) {
      updatedSubmission = await tx.submission.update({
        where: { id: submission.id },
        data: {
          status: parsed.data.statusUpdate,
          completedAt:
            parsed.data.statusUpdate === SubmissionStatus.completed
              ? submission.completedAt ?? now
              : submission.completedAt,
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
    }

    return { feedback, updatedSubmission };
  });

  return NextResponse.json(result, { status: 201 });
}
