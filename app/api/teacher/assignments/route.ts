import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guards";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  classId: z.string().min(1),
  activityVersionId: z.string().min(1),
  title: z.string().min(1),
  settingsJson: z
    .object({
      attemptsAllowed: z.number().int().positive().default(1),
      allowUploads: z.boolean().default(false),
      showFeedback: z.boolean().default(true),
    })
    .default({ attemptsAllowed: 1, allowUploads: false, showFeedback: true }),
  startAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const assignments = await prisma.assignment.findMany({
    where: {
      class: {
        teacherId: auth.session.user.id,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      dueAt: true,
      createdAt: true,
      class: {
        select: { id: true, name: true },
      },
      activityVersion: {
        select: {
          id: true,
          versionNumber: true,
          activity: {
            select: { title: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ assignments });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = parsed.data;

  const teacherClass = await prisma.class.findFirst({
    where: {
      id: payload.classId,
      teacherId: auth.session.user.id,
    },
    select: { id: true },
  });

  if (!teacherClass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const activityVersion = await prisma.activityVersion.findFirst({
    where: {
      id: payload.activityVersionId,
      publishedAt: { not: null },
      activity: { teacherId: auth.session.user.id },
    },
    select: { id: true },
  });

  if (!activityVersion) {
    return NextResponse.json({ error: "Published activity version not found" }, { status: 404 });
  }

  const assignment = await prisma.assignment.create({
    data: {
      classId: payload.classId,
      activityVersionId: payload.activityVersionId,
      title: payload.title,
      settingsJson: payload.settingsJson,
      startAt: payload.startAt ? new Date(payload.startAt) : null,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
    },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
