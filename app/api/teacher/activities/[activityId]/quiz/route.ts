import { ActivityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

const nonEmptyTrimmedString = z.string().transform((value) => value.trim()).refine((value) => value.length > 0);

const questionSchema = z.object({
  id: nonEmptyTrimmedString,
  prompt: nonEmptyTrimmedString,
  choices: z.array(nonEmptyTrimmedString).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().optional().transform((value) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }),
});

const quizSchema = z.object({
  title: nonEmptyTrimmedString,
  instructions: z.string().optional().transform((value) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }),
  questions: z.array(questionSchema).min(1),
});

type RouteContext = {
  params: {
    activityId: string;
  };
};

export async function PUT(req: Request, { params }: RouteContext) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = quizSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.activity.findFirst({
    where: {
      id: params.activityId,
      teacherId: auth.session.user.id,
      templateType: "quiz",
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const draftConfigJson = {
    templateType: "quiz" as const,
    title: parsed.data.title,
    instructions: parsed.data.instructions,
    questions: parsed.data.questions,
  };

  await prisma.activity.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.instructions ?? null,
      status: ActivityStatus.draft,
      draftConfigJson,
    },
    select: {
      id: true,
    },
  });

  return NextResponse.json({ ok: true });
}
