import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guards";
import { buildQuizHtml } from "@/lib/templates.quiz";

const nonEmptyTrimmedString = z.string().transform((value) => value.trim()).refine((value) => value.length > 0);

const schema = z.object({
  templateType: z.literal("quiz"),
  title: nonEmptyTrimmedString,
  instructions: z.string().optional().transform((value) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }),
  questions: z.array(
    z.object({
      id: nonEmptyTrimmedString,
      prompt: nonEmptyTrimmedString,
      choices: z.array(nonEmptyTrimmedString).length(4),
      correctIndex: z.number().int().min(0).max(3),
      explanation: z.string().optional().transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      }),
    }),
  ).min(1),
});

export async function POST(req: Request) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const html = buildQuizHtml(parsed.data, { previewInline: true });
  return NextResponse.json({ html });
}
