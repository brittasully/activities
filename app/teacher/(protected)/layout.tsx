import { requireRole } from "@/lib/auth/guards";

export default async function TeacherProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireRole("teacher");
  return <>{children}</>;
}
