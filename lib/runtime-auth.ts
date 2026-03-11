import { NextResponse } from "next/server";
import { LaunchTokenValidationError, verifyLaunchToken } from "@/lib/auth/launch-token";
import { prisma } from "@/lib/prisma";

export async function resolveSubmissionFromLaunchToken(launchToken: string) {
  try {
    const claims = verifyLaunchToken(launchToken);

    const submission = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: claims.assignmentId,
          studentId: claims.studentId,
        },
      },
      select: {
        id: true,
        assignmentId: true,
        studentId: true,
        status: true,
        startedAt: true,
      },
    });

    if (!submission) {
      return {
        ok: false as const,
        error: NextResponse.json({ error: "Submission not found for token" }, { status: 404 }),
      };
    }

    return {
      ok: true as const,
      claims,
      submission,
    };
  } catch (error) {
    if (error instanceof LaunchTokenValidationError) {
      return {
        ok: false as const,
        error: NextResponse.json({ error: error.message }, { status: 401 }),
      };
    }

    throw error;
  }
}
