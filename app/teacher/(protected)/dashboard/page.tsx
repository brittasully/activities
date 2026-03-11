import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireRole } from "@/lib/auth/guards";

export default async function TeacherDashboardPage() {
  const session = await requireRole("teacher");

  return (
    <main>
      <h1>Teacher Dashboard</h1>
      <p>Logged in as {session.user.name}</p>
      <ul>
        <li>
          <Link href="/teacher/activities">Activities</Link>
        </li>
        <li>
          <Link href="/teacher/assignments">Assignments</Link>
        </li>
      </ul>
      <LogoutButton redirectTo="/teacher/login" />
    </main>
  );
}
