(() => {
  const statusEl = document.getElementById("status");
  const stateEl = document.getElementById("state");

  let ready = false;
  const state = { answers: {}, score: 0, maxScore: 2 };

  function makeRequestId() {
    if (window.crypto && "randomUUID" in window.crypto) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function postToParent(kind, payload) {
    return new Promise((resolve, reject) => {
      const requestId = makeRequestId();
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Timeout waiting for ACK"));
      }, 7000);

      function onMessage(event) {
        if (event.source !== window.parent) return;
        const message = event.data || {};
        if (message.requestId !== requestId) return;

        if (message.kind === "ACK") {
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          resolve(message.payload || { ok: true });
        } else if (message.kind === "ERROR") {
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          reject(new Error(message.error || "Runtime error"));
        }
      }

      window.addEventListener("message", onMessage);
      window.parent.postMessage({ kind, requestId, payload }, "*");
    });
  }

  window.ActivityAPI = {
    reportEvent(type, payload) {
      return postToParent("EVENT", { type, data: payload });
    },
    saveState(stateJson) {
      return postToParent("SAVE_STATE", stateJson);
    },
    submitAnswer(answerPayload) {
      return postToParent("SUBMIT_ANSWER", answerPayload);
    },
    uploadArtifact(fileBlob, metadata) {
      return postToParent("UPLOAD_REQUEST", { fileBlob, metadata });
    },
    complete(summaryPayload) {
      return postToParent("COMPLETE", summaryPayload);
    },
  };

  window.addEventListener("message", async (event) => {
    if (event.source !== window.parent) return;
    const message = event.data || {};
    if (message.kind !== "INIT") return;

    ready = Boolean(message.launchToken);
    statusEl.textContent = ready ? "Initialized and ready" : "Missing launch token";
    window.parent.postMessage({ kind: "READY" }, "*");

    if (ready) {
      await window.ActivityAPI.reportEvent("activity_started", { startedAt: new Date().toISOString() });
    }
  });

  function renderState() {
    stateEl.textContent = JSON.stringify(state, null, 2);
  }

  document.querySelectorAll("button[data-answer]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!ready) return;
      const index = Array.from(document.querySelectorAll("button[data-answer]")).indexOf(button);
      const questionId = index < 3 ? "q1" : "q2";
      const choice = Number(button.getAttribute("data-answer"));

      state.answers[questionId] = choice;
      const correct = (questionId === "q1" && choice === 1) || (questionId === "q2" && choice === 1);
      state.score = Object.entries(state.answers).filter(([q, a]) => (q === "q1" || q === "q2") && a === 1).length;
      renderState();

      await window.ActivityAPI.submitAnswer({ questionId, choice, correct, score: state.score, maxScore: state.maxScore });
      await window.ActivityAPI.saveState(state);
    });
  });

  document.getElementById("finish").addEventListener("click", async () => {
    if (!ready) return;
    await window.ActivityAPI.complete({ score: state.score, maxScore: state.maxScore, completedAt: new Date().toISOString() });
    statusEl.textContent = "Activity completed!";
  });

  renderState();
})();
