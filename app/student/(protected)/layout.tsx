import { requireRole } from "@/lib/auth/guards";

export default async function StudentProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireRole("student");
  return <>{children}</>;
}
