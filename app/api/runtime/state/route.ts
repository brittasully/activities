import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSubmissionFromLaunchToken } from "@/lib/runtime-auth";

const schema = z.object({
  launchToken: z.string().min(1),
  stateJson: z.unknown(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resolved = await resolveSubmissionFromLaunchToken(parsed.data.launchToken);
  if (!resolved.ok) return resolved.error;

  await prisma.submission.update({
    where: { id: resolved.submission.id },
    data: {
      latestStateJson: parsed.data.stateJson,
      lastActiveAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
