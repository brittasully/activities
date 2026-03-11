"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type FeedbackItem = {
  id: string;
  commentText: string;
  statusUpdate: string | null;
  createdAt: string;
  teacher: {
    id: string;
    name: string;
  };
};

type SubmissionPayload = {
  submission: {
    id: string;
    status: string;
    score: number | null;
    maxScore: number | null;
    startedAt: string | null;
    completedAt: string | null;
    lastActiveAt: string | null;
    latestStateJson: unknown;
    student: {
      id: string;
      name: string;
    };
    assignment: {
      id: string;
      title: string;
      class: {
        id: string;
        name: string;
      };
    };
    submissionEvents: Array<{
      id: string;
      type: string;
      payloadJson: unknown;
      createdAt: string;
    }>;
    artifacts: Array<{
      id: string;
      type: string;
      storageUrl: string;
      filename: string;
      mimeType: string;
      createdAt: string;
    }>;
    feedback: FeedbackItem[];
  };
};

const statusOptions = ["reviewed", "needs_revision", "completed"] as const;

function fmtDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function scoreText(score: number | null, maxScore: number | null) {
  if (score == null || maxScore == null) return "—";
  return `${score}/${maxScore}`;
}

export default function TeacherSubmissionDetailPage() {
  const params = useParams<{ submissionId: string }>();
  const [data, setData] = useState<SubmissionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<typeof statusOptions[number]>("reviewed");
  const [commentText, setCommentText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"" | typeof statusOptions[number]>("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);

  const latestFeedback = useMemo(() => data?.submission.feedback[0] ?? null, [data]);

  async function load() {
    const response = await fetch(`/api/teacher/submissions/${params.submissionId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to load submission");
      return;
    }

    const payload = (await response.json()) as SubmissionPayload;
    setData(payload);
    setStatusUpdate((payload.submission.status as typeof statusOptions[number]) || "reviewed");
    setError(null);
  }

  useEffect(() => {
    load();
  }, [params.submissionId]);

  async function onSaveStatus(event: FormEvent) {
    event.preventDefault();
    setSavingStatus(true);

    const response = await fetch(`/api/teacher/submissions/${params.submissionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusUpdate }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to update status");
      setSavingStatus(false);
      return;
    }

    await load();
    setSavingStatus(false);
  }

  async function onSaveFeedback(event: FormEvent) {
    event.preventDefault();
    if (!commentText.trim()) return;

    setSavingFeedback(true);

    const response = await fetch(`/api/teacher/submissions/${params.submissionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commentText: commentText.trim(),
        statusUpdate: feedbackStatus || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to save feedback");
      setSavingFeedback(false);
      return;
    }

    setCommentText("");
    setFeedbackStatus("");
    await load();
    setSavingFeedback(false);
  }

  return (
    <main>
      <h1>Submission Detail</h1>
      {error && <p>{error}</p>}
      {data && (
        <>
          <p><strong>Student:</strong> {data.submission.student.name}</p>
          <p><strong>Assignment:</strong> {data.submission.assignment.title}</p>
          <p><strong>Class:</strong> {data.submission.assignment.class.name}</p>
          <p><strong>Status:</strong> {data.submission.status}</p>
          <p><strong>Score:</strong> {scoreText(data.submission.score, data.submission.maxScore)}</p>

          <section>
            <h2>Status Controls</h2>
            <form onSubmit={onSaveStatus}>
              <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value as typeof statusOptions[number])}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button type="submit" disabled={savingStatus}>{savingStatus ? "Saving..." : "Save"}</button>
            </form>
          </section>

          <section>
            <h2>Teacher Feedback</h2>
            <form onSubmit={onSaveFeedback}>
              <textarea
                rows={4}
                placeholder="Add feedback"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                required
              />
              <label>
                Optional status update
                <select value={feedbackStatus} onChange={(e) => setFeedbackStatus(e.target.value as "" | typeof statusOptions[number])}>
                  <option value="">No status change</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={savingFeedback}>{savingFeedback ? "Saving..." : "Save feedback"}</button>
            </form>

            <h3>Latest feedback</h3>
            {latestFeedback ? (
              <div>
                <p>{latestFeedback.commentText}</p>
                <p>
                  By {latestFeedback.teacher.name} at {fmtDate(latestFeedback.createdAt)}
                  {latestFeedback.statusUpdate ? ` (status: ${latestFeedback.statusUpdate})` : ""}
                </p>
              </div>
            ) : (
              <p>—</p>
            )}

            <h3>All feedback</h3>
            <ul>
              {data.submission.feedback.map((item) => (
                <li key={item.id}>
                  {item.commentText} — {item.teacher.name} — {fmtDate(item.createdAt)}
                  {item.statusUpdate ? ` (${item.statusUpdate})` : ""}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Event timeline</h2>
            <ul>
              {data.submission.submissionEvents.map((event) => (
                <li key={event.id}>
                  <div>{fmtDate(event.createdAt)} — <strong>{event.type}</strong></div>
                  <details>
                    <summary>View payload JSON</summary>
                    <pre>{JSON.stringify(event.payloadJson, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Saved state</h2>
            <pre>{JSON.stringify(data.submission.latestStateJson, null, 2)}</pre>
          </section>

          <section>
            <h2>Artifacts</h2>
            <ul>
              {data.submission.artifacts.map((artifact) => (
                <li key={artifact.id}>
                  <div>{artifact.filename} ({artifact.type}) — {fmtDate(artifact.createdAt)}</div>
                  {artifact.mimeType.startsWith("image/") ? (
                    <img src={artifact.storageUrl} alt={artifact.filename} style={{ maxWidth: 320 }} />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
