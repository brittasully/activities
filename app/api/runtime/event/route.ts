import { SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSubmissionFromLaunchToken } from "@/lib/runtime-auth";

const schema = z.object({
  launchToken: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resolved = await resolveSubmissionFromLaunchToken(parsed.data.launchToken);
  if (!resolved.ok) return resolved.error;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.submissionEvent.create({
      data: {
        submissionId: resolved.submission.id,
        type: parsed.data.type,
        payloadJson: parsed.data.payload,
      },
    });

    await tx.submission.update({
      where: { id: resolved.submission.id },
      data: {
        lastActiveAt: now,
        status:
          parsed.data.type === "activity_started" && resolved.submission.status === SubmissionStatus.not_started
            ? SubmissionStatus.in_progress
            : resolved.submission.status,
        startedAt:
          parsed.data.type === "activity_started" && resolved.submission.status === SubmissionStatus.not_started
            ? resolved.submission.startedAt ?? now
            : resolved.submission.startedAt,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
