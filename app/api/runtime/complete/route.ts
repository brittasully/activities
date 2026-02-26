import { SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSubmissionFromLaunchToken } from "@/lib/runtime-auth";

const schema = z.object({
  launchToken: z.string().min(1),
  summary: z.record(z.any()),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resolved = await resolveSubmissionFromLaunchToken(parsed.data.launchToken);
  if (!resolved.ok) return resolved.error;

  const summary = parsed.data.summary;

  await prisma.$transaction(async (tx) => {
    await tx.submissionEvent.create({
      data: {
        submissionId: resolved.submission.id,
        type: "activity_completed",
        payloadJson: summary,
      },
    });

    await tx.submission.update({
      where: { id: resolved.submission.id },
      data: {
        status: SubmissionStatus.completed,
        completedAt: new Date(),
        lastActiveAt: new Date(),
        score: typeof summary.score === "number" ? summary.score : undefined,
        maxScore: typeof summary.maxScore === "number" ? summary.maxScore : undefined,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
