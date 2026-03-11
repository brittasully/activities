import { ActivityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guards";
import { writePublishedBundle } from "@/lib/bundles";
import type { QuizDraftConfig } from "@/lib/templates.quiz";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  entryPath: z.string().min(1).optional(),
});

const quizDraftSchema = z.object({
  templateType: z.literal("quiz"),
  title: z.string().min(1),
  instructions: z.string().optional(),
  questions: z.array(
    z.object({
      id: z.string().min(1),
      prompt: z.string().min(1),
      choices: z.array(z.string().min(1)).length(4),
      correctIndex: z.number().int().min(0).max(3),
      explanation: z.string().optional(),
    }),
  ).min(1),
});

type RouteContext = {
  params: {
    activityId: string;
  };
};

export async function POST(req: Request, { params }: RouteContext) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const activity = await prisma.activity.findFirst({
    where: {
      id: params.activityId,
      teacherId: auth.session.user.id,
    },
    select: {
      id: true,
      templateType: true,
      draftConfigJson: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { versionNumber: true },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  let quizDraft: QuizDraftConfig | null = null;
  if (activity.templateType === "quiz") {
    const draftParse = quizDraftSchema.safeParse(activity.draftConfigJson);
    if (!draftParse.success) {
      return NextResponse.json({ error: "Quiz draft is missing or invalid. Save draft before publishing." }, { status: 400 });
    }
    quizDraft = draftParse.data;
  }

  const nextVersionNumber = (activity.versions[0]?.versionNumber ?? 0) + 1;

  const createdVersion = await prisma.activityVersion.create({
    data: {
      activityId: activity.id,
      versionNumber: nextVersionNumber,
      bundleKey: `runtime-bundles/${crypto.randomUUID()}`,
      entryPath: parsed.data.entryPath ?? "index.html",
      manifestJson: {},
      publishedAt: new Date(),
    },
  });

  const bundle = await writePublishedBundle({
    activityVersionId: createdVersion.id,
    entryPath: createdVersion.entryPath,
    templateType: activity.templateType,
    draftConfig: quizDraft,
  });

  const version = await prisma.activityVersion.update({
    where: { id: createdVersion.id },
    data: {
      bundleKey: bundle.bundleKey,
      entryPath: bundle.entryPath,
      manifestJson: bundle.manifest,
      publishedAt: new Date(),
    },
  });

  await prisma.activity.update({
    where: { id: activity.id },
    data: { status: ActivityStatus.published },
  });

  return NextResponse.json({
    activityVersionId: version.id,
    versionNumber: version.versionNumber,
    entryPath: version.entryPath,
    version,
  }, { status: 201 });
}
