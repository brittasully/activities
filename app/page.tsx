import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Activities Auth MVP</h1>
      <ul>
        <li><Link href="/teacher/signup">Teacher Signup</Link></li>
        <li><Link href="/teacher/login">Teacher Login</Link></li>
        <li><Link href="/teacher/activities">Teacher Activities</Link></li>
        <li><Link href="/teacher/assignments">Teacher Assignments</Link></li>
        <li><Link href="/student/login">Student Login</Link></li>
      </ul>
    </main>
  );
}
