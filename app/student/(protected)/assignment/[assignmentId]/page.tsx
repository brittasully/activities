"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type LaunchResponse = {
  submissionId: string;
  launchToken: string;
  activityVersion: {
    id: string;
    bundleKey: string;
    entryPath: string;
    manifestJson: unknown;
  };
};

type RuntimeRequest = {
  kind: "EVENT" | "SAVE_STATE" | "SUBMIT_ANSWER" | "UPLOAD_REQUEST" | "COMPLETE";
  requestId: string;
  payload: unknown;
};

const allowedKinds = new Set<RuntimeRequest["kind"]>([
  "EVENT",
  "SAVE_STATE",
  "SUBMIT_ANSWER",
  "UPLOAD_REQUEST",
  "COMPLETE",
]);

export default function StudentAssignmentLaunchPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const [data, setData] = useState<LaunchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const runtimeUrl = useMemo(() => {
    if (!data) return null;
    return `/runtime/bundles/${data.activityVersion.id}/${data.activityVersion.entryPath}`;
  }, [data]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const response = await fetch(`/api/student/assignments/${assignmentId}/launch`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to launch assignment");
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as LaunchResponse;
      setData(payload);
      setLoading(false);
    };

    run();
  }, [assignmentId]);

  useEffect(() => {
    if (!data || !runtimeUrl) return;

    let initialized = false;
    let disposed = false;

    const runtimeOrigin = new URL(runtimeUrl, window.location.origin).origin;

    const sendInit = () => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;

      iframeWindow.postMessage(
        {
          kind: "INIT",
          launchToken: data.launchToken,
          assignmentId,
        },
        runtimeOrigin,
      );
      initialized = true;
    };

    const onMessage = async (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;
      if (event.origin !== runtimeOrigin) return;

      const message = event.data as { kind?: string; requestId?: string; payload?: unknown };
      if (!message?.kind) return;

      if (message.kind === "READY") {
        setReady(true);
        return;
      }

      if (!initialized || !data.launchToken) {
        iframeWindow.postMessage({ kind: "ERROR", requestId: message.requestId, error: "Bridge not initialized" }, runtimeOrigin);
        return;
      }

      if (!allowedKinds.has(message.kind as RuntimeRequest["kind"])) {
        iframeWindow.postMessage({ kind: "ERROR", requestId: message.requestId, error: "Unsupported message kind" }, runtimeOrigin);
        return;
      }

      const routeByKind: Record<RuntimeRequest["kind"], string> = {
        EVENT: "/api/runtime/event",
        SAVE_STATE: "/api/runtime/state",
        SUBMIT_ANSWER: "/api/runtime/answer",
        UPLOAD_REQUEST: "/api/runtime/upload-url",
        COMPLETE: "/api/runtime/complete",
      };

      const bodyByKind: Record<RuntimeRequest["kind"], Record<string, unknown>> = {
        EVENT: {
          launchToken: data.launchToken,
          type: "unknown",
          payload: null,
        },
        SAVE_STATE: {
          launchToken: data.launchToken,
          stateJson: null,
        },
        SUBMIT_ANSWER: {
          launchToken: data.launchToken,
          answerPayload: null,
        },
        UPLOAD_REQUEST: {
          launchToken: data.launchToken,
          payload: null,
        },
        COMPLETE: {
          launchToken: data.launchToken,
          summary: null,
        },
      };

      const kind = message.kind as RuntimeRequest["kind"];
      const body = { ...bodyByKind[kind] };

      if (kind === "EVENT") {
        const payload = (message.payload as { type?: string; data?: unknown }) ?? {};
        body.type = payload.type ?? "event";
        body.payload = payload.data ?? {};
      } else if (kind === "SAVE_STATE") {
        body.stateJson = message.payload ?? {};
      } else if (kind === "SUBMIT_ANSWER") {
        body.answerPayload = message.payload ?? {};
      } else if (kind === "COMPLETE") {
        body.summary = message.payload ?? {};
      } else {
        body.payload = message.payload ?? {};
      }

      const response = await fetch(routeByKind[kind], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        iframeWindow.postMessage(
          {
            kind: "ERROR",
            requestId: message.requestId,
            error: payload?.error ?? "Runtime action failed",
          },
          runtimeOrigin,
        );
        return;
      }

      iframeWindow.postMessage(
        {
          kind: "ACK",
          requestId: message.requestId,
          payload,
        },
        runtimeOrigin,
      );
    };

    window.addEventListener("message", onMessage);

    const timeout = window.setTimeout(() => {
      if (!disposed) {
        sendInit();
      }
    }, 100);

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };
  }, [assignmentId, data, runtimeUrl]);

  return (
    <main>
      <h1>Assignment Launch</h1>
      {loading && <p>Preparing launch...</p>}
      {error && <p>{error}</p>}
      {data && runtimeUrl && (
        <section>
          <h2>Launch ready</h2>
          <p>Submission ID: {data.submissionId}</p>
          <p>Bridge status: {ready ? "READY" : "Waiting for runtime..."}</p>
          <iframe
            ref={iframeRef}
            title="Activity Runtime"
            src={runtimeUrl}
            sandbox="allow-scripts allow-forms"
            style={{ width: "100%", minHeight: 460, border: "1px solid #ccc" }}
          />
          <button type="button">Continue</button>
        </section>
      )}
    </main>
  );
}
