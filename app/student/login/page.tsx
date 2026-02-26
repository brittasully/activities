"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentLoginPage() {
  const [accessCode, setAccessCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode, studentName }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to log in");
      return;
    }

    router.push("/student/home");
  }

  return (
    <main>
      <h1>Student Login</h1>
      <form onSubmit={onSubmit}>
        <input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Class access code" required />
        <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student name" required />
        <button type="submit">Log in</button>
      </form>
      {error && <p>{error}</p>}
    </main>
  );
}
