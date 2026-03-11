import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSubmissionFromLaunchToken } from "@/lib/runtime-auth";

const schema = z.object({
  launchToken: z.string().min(1),
  answerPayload: z.record(z.any()),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resolved = await resolveSubmissionFromLaunchToken(parsed.data.launchToken);
  if (!resolved.ok) return resolved.error;

  const payload = parsed.data.answerPayload;

  await prisma.$transaction(async (tx) => {
    await tx.submissionEvent.create({
      data: {
        submissionId: resolved.submission.id,
        type: "answer_submitted",
        payloadJson: payload,
      },
    });

    await tx.submission.update({
      where: { id: resolved.submission.id },
      data: {
        lastActiveAt: new Date(),
        score: typeof payload.score === "number" ? payload.score : undefined,
        maxScore: typeof payload.maxScore === "number" ? payload.maxScore : undefined,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
