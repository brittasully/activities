import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guards";

const gradeBands = ["K-1", "2-3", "4-5", "6-8"] as const;

const schema = z.object({
  topic: z.string().transform((value) => value.trim()).refine((value) => value.length > 0),
  gradeBand: z.enum(gradeBands),
  count: z.number().int().min(1).max(10),
});

type GradeBand = (typeof gradeBands)[number];

type GeneratedQuestion = {
  id: string;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: number;
  explanation?: string;
};

const stemsByGrade: Record<GradeBand, string[]> = {
  "K-1": [
    "Which choice best matches",
    "Pick the best answer about",
    "Which statement is true about",
    "Find the best fact about",
  ],
  "2-3": [
    "Which answer best explains",
    "Choose the best example of",
    "Which choice correctly describes",
    "Pick the strongest fact about",
  ],
  "4-5": [
    "Which option best summarizes",
    "Choose the most accurate statement about",
    "Which detail best supports understanding of",
    "Pick the strongest explanation of",
  ],
  "6-8": [
    "Which claim is most accurate about",
    "Choose the best-supported statement about",
    "Which option best analyzes",
    "Pick the most precise explanation of",
  ],
};

function buildQuestion(topic: string, gradeBand: GradeBand, index: number): GeneratedQuestion {
  const stems = stemsByGrade[gradeBand];
  const stem = stems[index % stems.length];
  const sequence = index + 1;
  const prompt = `${stem} ${topic} (${sequence})?`;

  const correct = `${topic} is explained with clear, accurate details.`;
  const distractors = [
    `${topic} means the opposite in every situation.`,
    `${topic} can never be observed or discussed.`,
    `${topic} is unrelated to learning goals in class.`,
  ];

  const correctIndex = index % 4;
  const choices = [...distractors];
  choices.splice(correctIndex, 0, correct);

  return {
    id: `gen-${sequence}`,
    prompt,
    choices: choices as [string, string, string, string],
    correctIndex,
    explanation: `This choice is correct because it gives an accurate, school-appropriate description of ${topic}.`,
  };
}

export async function POST(req: Request) {
  const auth = await requireApiRole("teacher");
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { topic, gradeBand, count } = parsed.data;
  const questions = Array.from({ length: count }, (_, index) => buildQuestion(topic, gradeBand, index));

  return NextResponse.json({ questions });
}
