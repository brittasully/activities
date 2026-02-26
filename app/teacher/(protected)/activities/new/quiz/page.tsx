"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Question = {
  id: string;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: number;
  explanation?: string;
};

type QuizDraftPayload = {
  templateType: "quiz";
  title: string;
  instructions?: string;
  questions: Question[];
};

type DraftActivityResponse = {
  activity: {
    id: string;
    draftConfigJson?: QuizDraftPayload | null;
  };
};

type GradeBand = "K-1" | "2-3" | "4-5" | "6-8";

function makeQuestion(index: number): Question {
  return {
    id: `q${index + 1}`,
    prompt: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
  };
}

function sanitizeQuestions(questions: Question[]): Question[] {
  return questions.map((question, index) => {
    const rawId = question.id.trim();
    return {
      ...question,
      id: rawId || `q${index + 1}`,
      prompt: question.prompt.trim(),
      choices: question.choices.map((choice) => choice.trim()) as [string, string, string, string],
      explanation: question.explanation?.trim() || undefined,
    };
  });
}

function validateDraft(title: string, questions: Question[]) {
  if (!title.trim()) return false;
  if (questions.length < 1) return false;

  for (const question of questions) {
    if (!question.id.trim()) return false;
    if (!question.prompt.trim()) return false;
    if (question.choices.length !== 4) return false;
    if (question.correctIndex < 0 || question.correctIndex > 3) return false;
    if (question.choices.some((choice) => !choice.trim())) return false;
  }

  return true;
}

export default function NewQuizBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryActivityId = searchParams.get("activityId");

  const [activityId, setActivityId] = useState<string | null>(queryActivityId);
  const [title, setTitle] = useState("Fractions Quick Check");
  const [instructions, setInstructions] = useState("Choose the best answer for each question.");
  const [questions, setQuestions] = useState<Question[]>([makeQuestion(0), makeQuestion(1), makeQuestion(2)]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ activityVersionId: string; entryPath: string; versionNumber: number } | null>(null);
  const [generatorTopic, setGeneratorTopic] = useState("fractions");
  const [generatorGradeBand, setGeneratorGradeBand] = useState<GradeBand>("4-5");
  const [generatorCount, setGeneratorCount] = useState(5);

  useEffect(() => {
    setActivityId(queryActivityId);
  }, [queryActivityId]);

  useEffect(() => {
    const run = async () => {
      if (!queryActivityId) return;

      setLoadingDraft(true);
      setError(null);
      const response = await fetch(`/api/teacher/activities/${queryActivityId}`, { cache: "no-store" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to load draft");
        setLoadingDraft(false);
        return;
      }

      const payload = (await response.json()) as DraftActivityResponse;
      const draft = payload.activity.draftConfigJson;
      if (draft?.templateType === "quiz") {
        setTitle(draft.title ?? "");
        setInstructions(draft.instructions ?? "");
        setQuestions(draft.questions.length ? sanitizeQuestions(draft.questions as Question[]) : [makeQuestion(0)]);
      }

      setDirty(false);
      setLoadingDraft(false);
    };

    run();
  }, [queryActivityId]);

  const sanitizedQuestions = useMemo(() => sanitizeQuestions(questions), [questions]);

  const draftPayload = useMemo(
    () => ({
      title: title.trim(),
      instructions: instructions.trim() || undefined,
      questions: sanitizedQuestions,
    }),
    [instructions, sanitizedQuestions, title],
  );

  const publishDisabled = useMemo(() => !validateDraft(title, sanitizedQuestions) || loadingDraft || savingDraft || publishing, [
    loadingDraft,
    publishing,
    sanitizedQuestions,
    savingDraft,
    title,
  ]);

  function setChanged(next: () => void) {
    next();
    setDirty(true);
    setStatus(null);
    setPublishResult(null);
  }

  function updateQuestion(index: number, updater: (question: Question) => Question) {
    setChanged(() => {
      setQuestions((prev) => prev.map((q, i) => (i === index ? updater(q) : q)));
    });
  }

  function addQuestion() {
    setChanged(() => {
      setQuestions((prev) => [...prev, makeQuestion(prev.length)]);
    });
  }

  function removeQuestion(index: number) {
    setChanged(() => {
      setQuestions((prev) => {
        const next = prev.filter((_, i) => i !== index);
        return next.length ? next : [makeQuestion(0)];
      });
    });
  }

  async function generateQuestions() {
    setGenerating(true);
    setError(null);

    const topic = generatorTopic.trim();
    if (!topic) {
      setError("Enter a topic before generating questions.");
      setGenerating(false);
      return;
    }

    const response = await fetch("/api/teacher/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        gradeBand: generatorGradeBand,
        count: generatorCount,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to generate questions");
      setGenerating(false);
      return;
    }

    const payload = (await response.json()) as { questions: Question[] };
    setChanged(() => {
      setQuestions(sanitizeQuestions(payload.questions));
    });
    setStatus(`Generated ${payload.questions.length} questions.`);
    setGenerating(false);
  }

  async function saveDraft() {
    setSavingDraft(true);
    setError(null);

    if (!validateDraft(title, sanitizedQuestions)) {
      setError("Please complete title, question ids, prompts, and all 4 choices before saving.");
      setSavingDraft(false);
      return null;
    }

    const method = activityId ? "PUT" : "POST";
    const endpoint = activityId ? `/api/teacher/activities/${activityId}/quiz` : "/api/teacher/activities/quiz";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftPayload),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to save draft");
      setSavingDraft(false);
      return null;
    }

    if (activityId) {
      setStatus("Saved");
      setDirty(false);
      setSavingDraft(false);
      return activityId;
    }

    const payload = (await response.json()) as { activityId?: string };
    const createdId = payload.activityId ?? null;
    if (!createdId) {
      setError("Draft saved but no activityId was returned");
      setSavingDraft(false);
      return null;
    }

    setActivityId(createdId);
    setStatus("Saved");
    setDirty(false);
    setSavingDraft(false);
    router.replace(`/teacher/activities/new/quiz?activityId=${createdId}`);
    return createdId;
  }

  async function openPreview() {
    setError(null);

    if (!validateDraft(title, sanitizedQuestions)) {
      setError("Please complete required quiz fields before preview.");
      return;
    }

    const response = await fetch("/api/teacher/preview/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateType: "quiz",
        title: draftPayload.title,
        instructions: draftPayload.instructions,
        questions: draftPayload.questions,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to generate preview");
      return;
    }

    const payload = (await response.json()) as { html: string };
    setPreviewHtml(payload.html);
    setShowPreview(true);
  }

  async function publish() {
    setPublishing(true);
    setError(null);

    if (!validateDraft(title, sanitizedQuestions)) {
      setError("Fix validation issues before publishing.");
      setPublishing(false);
      return;
    }

    let id = activityId;
    if (dirty || !id) {
      id = await saveDraft();
    }

    if (!id) {
      setPublishing(false);
      return;
    }

    const response = await fetch(`/api/teacher/activities/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryPath: "index.html" }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to publish");
      setPublishing(false);
      return;
    }

    const payload = (await response.json()) as {
      activityVersionId?: string;
      versionNumber?: number;
      entryPath?: string;
    };

    if (!payload.activityVersionId || !payload.entryPath || typeof payload.versionNumber !== "number") {
      setError("Publish succeeded but response was missing version details");
      setPublishing(false);
      return;
    }

    setPublishResult({
      activityVersionId: payload.activityVersionId,
      entryPath: payload.entryPath,
      versionNumber: payload.versionNumber,
    });
    setStatus("Published ✅");
    setDirty(false);
    setPublishing(false);
  }

  return (
    <main>
      <h1>{activityId ? "Edit Quiz Draft" : "Create a Quiz"}</h1>
      {loadingDraft && <p>Loading draft...</p>}
      {status && <p>{status}</p>}
      {error && <p>{error}</p>}

      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Quiz title
          <input value={title} onChange={(e) => setChanged(() => setTitle(e.target.value))} required />
        </label>

        <label>
          Instructions
          <textarea value={instructions} onChange={(e) => setChanged(() => setInstructions(e.target.value))} rows={2} />
        </label>

        <fieldset style={{ marginBottom: "1rem" }}>
          <legend>Generate Questions (MVP)</legend>

          <label>
            Topic
            <input value={generatorTopic} onChange={(e) => setGeneratorTopic(e.target.value)} placeholder="e.g. fractions" />
          </label>

          <label>
            Grade band
            <select value={generatorGradeBand} onChange={(e) => setGeneratorGradeBand(e.target.value as GradeBand)}>
              <option value="K-1">K-1</option>
              <option value="2-3">2-3</option>
              <option value="4-5">4-5</option>
              <option value="6-8">6-8</option>
            </select>
          </label>

          <label>
            Number of questions
            <input
              type="number"
              min={1}
              max={10}
              value={generatorCount}
              onChange={(e) => setGeneratorCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            />
          </label>

          <button type="button" onClick={generateQuestions} disabled={generating || loadingDraft}>
            {generating ? "Generating..." : "Generate Questions"}
          </button>
        </fieldset>

        <h2>Questions</h2>
        {questions.map((question, index) => (
          <fieldset key={`${question.id}-${index}`} style={{ marginBottom: "1rem" }}>
            <legend>Question {index + 1}</legend>

            <label>
              Question id
              <input
                value={question.id}
                onChange={(e) => updateQuestion(index, (q) => ({ ...q, id: e.target.value }))}
                placeholder={`q${index + 1}`}
              />
            </label>

            <label>
              Prompt
              <input
                value={question.prompt}
                onChange={(e) => updateQuestion(index, (q) => ({ ...q, prompt: e.target.value }))}
                required
              />
            </label>

            {question.choices.map((choice, choiceIndex) => (
              <label key={choiceIndex}>
                Choice {choiceIndex + 1}
                <input
                  value={choice}
                  onChange={(e) =>
                    updateQuestion(index, (q) => {
                      const next = [...q.choices] as [string, string, string, string];
                      next[choiceIndex] = e.target.value;
                      return { ...q, choices: next };
                    })
                  }
                  required
                />
              </label>
            ))}

            <fieldset>
              <legend>Correct choice</legend>
              {question.choices.map((_, choiceIndex) => (
                <label key={choiceIndex} style={{ marginRight: "1rem" }}>
                  <input
                    type="radio"
                    name={`correct-${index}`}
                    checked={question.correctIndex === choiceIndex}
                    onChange={() => updateQuestion(index, (q) => ({ ...q, correctIndex: choiceIndex }))}
                  />
                  {choiceIndex + 1}
                </label>
              ))}
            </fieldset>

            <label>
              Explanation (optional)
              <input
                value={question.explanation ?? ""}
                onChange={(e) => updateQuestion(index, (q) => ({ ...q, explanation: e.target.value }))}
              />
            </label>

            <button type="button" onClick={() => removeQuestion(index)} disabled={questions.length <= 1}>
              Remove Question
            </button>
          </fieldset>
        ))}

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" onClick={addQuestion}>Add Question</button>
          <button type="button" onClick={saveDraft} disabled={savingDraft || loadingDraft}>{savingDraft ? "Saving..." : "Save Draft"}</button>
          <button type="button" onClick={openPreview} disabled={loadingDraft}>Preview</button>
          <button type="button" onClick={publish} disabled={publishDisabled}>{publishing ? "Publishing..." : "Publish"}</button>
        </div>
      </form>

      {showPreview && previewHtml && (
        <section>
          <h2>Preview</h2>
          <iframe
            title="Quiz preview"
            srcDoc={previewHtml}
            sandbox="allow-scripts allow-forms"
            style={{ width: "100%", minHeight: 500, border: "1px solid #ccc" }}
          />
        </section>
      )}

      {publishResult && (
        <section>
          <h2>Published ✅</h2>
          <p>Version {publishResult.versionNumber}</p>
          <p>
            <Link href={`/teacher/assignments/new?activityVersionId=${publishResult.activityVersionId}`}>Create assignment</Link>
          </p>
          <p>
            <Link href={`/runtime/bundles/${publishResult.activityVersionId}/${publishResult.entryPath}`} target="_blank">
              Open published bundle
            </Link>
          </p>
          <p>
            <Link href="/teacher/activities">Back to activities</Link>
          </p>
        </section>
      )}
    </main>
  );
}
