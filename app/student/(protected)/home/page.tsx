"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";

type StudentAssignment = {
  id: string;
  title: string;
  dueAt: string | null;
  class: { id: string; name: string };
  status: string;
  submissionId: string | null;
};

export default function StudentHomePage() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/student/assignments", { cache: "no-store" });

      if (!response.ok) {
        setError("Unable to load assignments");
        return;
      }

      const data = (await response.json()) as { assignments: StudentAssignment[] };
      setAssignments(data.assignments);
    };

    run();
  }, []);

  return (
    <main>
      <h1>Student Home</h1>
      {error && <p>{error}</p>}
      <ul>
        {assignments.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.title}</strong> — {assignment.class.name} — Due: {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "No due date"} — Status: {assignment.status}{" "}
            <Link href={`/student/assignment/${assignment.id}`}>Start/Resume</Link>
          </li>
        ))}
      </ul>
      <LogoutButton redirectTo="/student/login" />
    </main>
  );
}
