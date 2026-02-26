import { prisma } from "@/lib/prisma";

export async function getStudentPrimaryClass(studentId: string) {
  const classStudent = await prisma.classStudent.findFirst({
    where: { studentId },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          accessCode: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return classStudent?.class ?? null;
}
