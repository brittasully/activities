import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export async function requireRole(role: UserRole) {
  const session = await getCurrentSession();

  if (!session || session.role !== role) {
    if (role === "teacher") {
      redirect("/teacher/login");
    }

    redirect("/student/login");
  }

  return session;
}
