"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TeacherClass = {
  id: string;
  name: string;
  gradeBand: string | null;
};

type PublishedVersion = {
  id: string;
  versionNumber: number;
  activity: { id: string; title: string };
};

export default function NewAssignmentPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [versions, setVersions] = useState<PublishedVersion[]>([]);
  const [classId, setClassId] = useState("");
  const [activityVersionId, setActivityVersionId] = useState("");
  const [title, setTitle] = useState("");
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [allowUploads, setAllowUploads] = useState(false);
  const [showFeedback, setShowFeedback] = useState(true);
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedVersionId = searchParams.get("activityVersionId");

  useEffect(() => {
    const run = async () => {
      const [classRes, versionRes] = await Promise.all([
        fetch("/api/teacher/classes", { cache: "no-store" }),
        fetch("/api/teacher/activity-versions/published", { cache: "no-store" }),
      ]);

      if (!classRes.ok || !versionRes.ok) {
        setError("Unable to load form data");
        return;
      }

      const classData = (await classRes.json()) as { classes: TeacherClass[] };
      const versionData = (await versionRes.json()) as { activityVersions: PublishedVersion[] };

      setClasses(classData.classes);
      setVersions(versionData.activityVersions);

      if (classData.classes[0]) setClassId(classData.classes[0].id);
      const preferred = preselectedVersionId && versionData.activityVersions.some((v) => v.id === preselectedVersionId)
        ? preselectedVersionId
        : versionData.activityVersions[0]?.id;
      if (preferred) setActivityVersionId(preferred);
    };

    run();
  }, [preselectedVersionId]);

  const hasLockedVersion = Boolean(preselectedVersionId && versions.some((version) => version.id === preselectedVersionId));
  const canSubmit = useMemo(() => classId && activityVersionId && title.trim().length > 0, [classId, activityVersionId, title]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    const response = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        activityVersionId,
        title: title.trim(),
        settingsJson: {
          attemptsAllowed,
          allowUploads,
          showFeedback,
        },
        startAt: startAt ? new Date(startAt).toISOString() : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to create assignment");
      return;
    }

    router.push("/teacher/assignments");
    router.refresh();
  }

  return (
    <main>
      <h1>Create Assignment</h1>
      <form onSubmit={onSubmit}>
        <label>
          Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)} required>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.gradeBand ? `(${c.gradeBand})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          Published Activity Version
          <select
            value={activityVersionId}
            onChange={(e) => setActivityVersionId(e.target.value)}
            required
            disabled={hasLockedVersion}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.activity.title} v{v.versionNumber}
              </option>
            ))}
          </select>
        </label>
        {hasLockedVersion && <p>Activity version is preselected from publish flow.</p>}

        <label>
          Assignment Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          Attempts Allowed
          <input
            type="number"
            min={1}
            value={attemptsAllowed}
            onChange={(e) => setAttemptsAllowed(Number(e.target.value) || 1)}
          />
        </label>

        <label>
          <input type="checkbox" checked={allowUploads} onChange={(e) => setAllowUploads(e.target.checked)} />
          Allow Uploads
        </label>

        <label>
          <input type="checkbox" checked={showFeedback} onChange={(e) => setShowFeedback(e.target.checked)} />
          Show Feedback
        </label>

        <label>
          Start At
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </label>

        <label>
          Due At
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>

        <button type="submit" disabled={!canSubmit}>
          Save Assignment
        </button>
      </form>
      {error && <p>{error}</p>}
    </main>
  );
}
