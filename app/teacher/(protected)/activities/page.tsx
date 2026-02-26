"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ActivityItem = {
  id: string;
  title: string;
  templateType: string;
  status: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    versionNumber: number;
    publishedAt: string | null;
  }>;
};

export default function TeacherActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  async function loadActivities() {
    const response = await fetch("/api/teacher/activities", { cache: "no-store" });
    if (!response.ok) {
      setError("Unable to load activities");
      return;
    }

    const payload = (await response.json()) as { activities: ActivityItem[] };
    setActivities(payload.activities);
    setError(null);
  }

  useEffect(() => {
    loadActivities();
  }, []);

  async function onPublish(activityId: string) {
    setPublishingId(activityId);
    const response = await fetch(`/api/teacher/activities/${activityId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryPath: "index.html" }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to publish activity");
      setPublishingId(null);
      return;
    }

    await loadActivities();
    setPublishingId(null);
  }

  return (
    <main>
      <h1>Teacher Activities</h1>
      <p>
        <Link href="/teacher/activities/new/quiz">Create a Quiz</Link>
      </p>
      {error && <p>{error}</p>}
      <ul>
        {activities.map((activity) => {
          const latest = activity.versions[0];
          return (
            <li key={activity.id}>
              <strong>{activity.title}</strong> ({activity.templateType}) — status: {activity.status} — latest version: {latest ? `v${latest.versionNumber}` : "none"} — updated: {new Date(activity.updatedAt).toLocaleString()} {" "}
              <button type="button" onClick={() => onPublish(activity.id)} disabled={publishingId === activity.id}>
                {publishingId === activity.id ? "Publishing..." : "Publish"}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
