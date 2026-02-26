"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AssignmentListItem = {
  id: string;
  title: string;
  dueAt: string | null;
  createdAt: string;
  class: { id: string; name: string };
};

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/teacher/assignments", { cache: "no-store" });
      if (!res.ok) {
        setError("Unable to load assignments");
        return;
      }
      const data = (await res.json()) as { assignments: AssignmentListItem[] };
      setAssignments(data.assignments);
    };

    run();
  }, []);

  return (
    <main>
      <h1>Teacher Assignments</h1>
      <p>
        <Link href="/teacher/assignments/new">Create Assignment</Link>
      </p>
      {error && <p>{error}</p>}
      <ul>
        {assignments.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.title}</strong> — {assignment.class.name} — Due: {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "No due date"} — Created: {new Date(assignment.createdAt).toLocaleString()} —{" "}
            <Link href={`/teacher/assignments/${assignment.id}/report`}>View report</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
