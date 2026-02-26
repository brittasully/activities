import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth/session";

const bodySchema = z.object({
  accessCode: z.string().min(1),
  studentName: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { accessCode, studentName } = parsed.data;

  const classroom = await prisma.class.findUnique({ where: { accessCode } });
  if (!classroom) {
    return NextResponse.json({ error: "Invalid class access code or student name" }, { status: 401 });
  }

  const student = await prisma.user.findFirst({
    where: {
      role: UserRole.student,
      name: {
        equals: studentName,
        mode: "insensitive",
      },
      classStudents: {
        some: {
          classId: classroom.id,
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Invalid class access code or student name" }, { status: 401 });
  }

  const classLink = await prisma.classStudent.findFirst({
    where: {
      classId: classroom.id,
      studentId: student.id,
    },
  });

  if (!classLink) {
    return NextResponse.json({ error: "Student is not in class roster" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(student.id, UserRole.student);
  const response = NextResponse.json({
    user: { id: student.id, name: student.name, role: student.role },
    class: { id: classroom.id, name: classroom.name },
  });
  setSessionCookie(response, token, expiresAt);

  return response;
}
