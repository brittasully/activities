"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type ProgressRow = {
  studentId: string;
  studentName: string;
  submissionId: string | null;
  status: string;
  score: number | null;
  maxScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  lastActiveAt: string | null;
};

type ReportPayload = {
  assignment: {
    id: string;
    title: string;
    dueAt: string | null;
    startAt: string | null;
  };
  class: { id: string; name: string };
  activity: { title: string };
  activityVersion: { id: string; versionNumber: number };
  progress: ProgressRow[];
};

function fmtDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function fmtScore(score: number | null, maxScore: number | null) {
  if (score == null || maxScore == null) return "—";
  return `${score}/${maxScore}`;
}

export default function TeacherAssignmentReportPage() {
  const params = useParams<{ assignmentId: string }>();
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const response = await fetch(`/api/teacher/assignments/${params.assignmentId}/report`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to load report");
        return;
      }

      const payload = (await response.json()) as ReportPayload;
      setData(payload);
    };

    run();
  }, [params.assignmentId]);

  return (
    <main>
      <h1>Assignment Report</h1>
      {error && <p>{error}</p>}
      {data && (
        <>
          <p><strong>Assignment:</strong> {data.assignment.title}</p>
          <p><strong>Class:</strong> {data.class.name}</p>
          <p><strong>Due:</strong> {fmtDate(data.assignment.dueAt)}</p>
          <p><strong>Activity:</strong> {data.activity.title} (v{data.activityVersion.versionNumber})</p>

          <table>
            <thead>
              <tr>
                <th align="left">Student Name</th>
                <th align="left">Submission Status</th>
                <th align="left">Score</th>
                <th align="left">Last Active</th>
                <th align="left">Started</th>
                <th align="left">Completed</th>
                <th align="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.progress.map((row) => (
                <tr key={row.studentId}>
                  <td>{row.studentName}</td>
                  <td>{row.status}</td>
                  <td>{fmtScore(row.score, row.maxScore)}</td>
                  <td>{fmtDate(row.lastActiveAt)}</td>
                  <td>{fmtDate(row.startedAt)}</td>
                  <td>{fmtDate(row.completedAt)}</td>
                  <td>
                    {row.submissionId ? (
                      <Link href={`/teacher/submissions/${row.submissionId}`}>View</Link>
                    ) : (
                      <span>Not started</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
