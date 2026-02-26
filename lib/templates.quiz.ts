export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
};

export type QuizDraftConfig = {
  templateType: "quiz";
  title: string;
  instructions?: string;
  questions: QuizQuestion[];
};

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildQuizRuntimeScript(config: QuizDraftConfig, options?: { preview?: boolean }) {
  const preview = options?.preview ?? false;
  const payload = JSON.stringify(config);

  return [
    "(() => {",
    `const quiz = ${payload};`,
    `const PREVIEW = ${preview};`,
    "const statusEl = document.getElementById('status');",
    "const appEl = document.getElementById('app');",
    "const finishEl = document.getElementById('finish');",
    "const resultEl = document.getElementById('result');",
    "const state = { currentIndex: 0, answers: {}, score: 0, maxScore: quiz.questions.length };",
    "let runtimeInitialized = PREVIEW;",
    "function createBridgeApi() {",
    "  const pending = new Map();",
    "  window.addEventListener('message', (event) => {",
    "    if (event.source !== window.parent) return;",
    "    const message = event.data || {};",
    "    if (!message.requestId || !pending.has(message.requestId)) return;",
    "    const handlers = pending.get(message.requestId);",
    "    pending.delete(message.requestId);",
    "    if (message.kind === 'ERROR') {",
    "      handlers.reject(new Error(message.error || 'Runtime bridge error'));",
    "      return;",
    "    }",
    "    if (message.kind === 'ACK') {",
    "      handlers.resolve(message.payload);",
    "      return;",
    "    }",
    "    handlers.resolve(message);",
    "  });",
    "",
    "  function request(kind, payload) {",
    "    if (PREVIEW || window.parent === window) {",
    "      return Promise.resolve({ ok: true, preview: true, kind, payload });",
    "    }",
    "",
    "    return new Promise((resolve, reject) => {",
    "      const requestId = (crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));",
    "      const timeoutId = window.setTimeout(() => {",
    "        pending.delete(requestId);",
    "        reject(new Error('Runtime bridge timeout'));",
    "      }, 10000);",
    "",
    "      pending.set(requestId, {",
    "        resolve: (value) => { window.clearTimeout(timeoutId); resolve(value); },",
    "        reject: (error) => { window.clearTimeout(timeoutId); reject(error); },",
    "      });",
    "",
    "      window.parent.postMessage({ kind, requestId, payload }, '*');",
    "    });",
    "  }",
    "",
    "  return {",
    "    reportEvent: (type, data) => request('EVENT', { type, data }),",
    "    submitAnswer: (payload) => request('SUBMIT_ANSWER', payload),",
    "    saveState: (payload) => request('SAVE_STATE', payload),",
    "    complete: (payload) => request('COMPLETE', payload),",
    "    uploadArtifact: (payload) => request('UPLOAD_REQUEST', payload),",
    "    score_updated: (payload) => request('EVENT', { type: 'score_updated', data: payload }),",
    "  };",
    "}",
    "if (!window.ActivityAPI) {",
    "  window.ActivityAPI = createBridgeApi();",
    "}",
    "",
    "function renderQuestion() {",
    "  const q = quiz.questions[state.currentIndex];",
    "  if (!q) { appEl.innerHTML = '<p>No questions configured.</p>'; return; }",
    "  const selected = state.answers[q.id];",
    "  appEl.innerHTML = '<div><p><strong>Question ' + (state.currentIndex + 1) + ' of ' + quiz.questions.length + '</strong></p><p>' + q.prompt + '</p><div id=\"choices\"></div><p id=\"explanation\"></p></div>';",
    "  const choicesEl = document.getElementById('choices');",
    "  const explanationEl = document.getElementById('explanation');",
    "  q.choices.forEach((choice, idx) => {",
    "    const btn = document.createElement('button');",
    "    btn.type = 'button';",
    "    btn.textContent = choice;",
    "    btn.style.display = 'block';",
    "    btn.style.marginBottom = '8px';",
    "    btn.style.outline = 'auto';",
    "    btn.disabled = selected !== undefined;",
    "    btn.onclick = async () => {",
    "      if (state.answers[q.id] !== undefined) return;",
    "      const correct = idx === q.correctIndex;",
    "      state.answers[q.id] = idx;",
    "      if (correct) state.score += 1;",
    "      await window.ActivityAPI.submitAnswer({ itemId: q.id, responseIndex: idx, correct, scoreDelta: correct ? 1 : 0, maxScore: state.maxScore, score: state.score });",
    "      if (window.ActivityAPI.score_updated) {",
    "        await window.ActivityAPI.score_updated({ score: state.score, maxScore: state.maxScore });",
    "      } else {",
    "        await window.ActivityAPI.reportEvent('score_updated', { score: state.score, maxScore: state.maxScore });",
    "      }",
    "      await window.ActivityAPI.saveState({ currentIndex: state.currentIndex, answers: state.answers });",
    "      explanationEl.textContent = correct ? 'Correct' : (q.explanation ? ('Incorrect. ' + q.explanation) : 'Incorrect.');",
    "      renderQuestion();",
    "    };",
    "    choicesEl.appendChild(btn);",
    "  });",
    "  finishEl.style.display = state.currentIndex === quiz.questions.length - 1 ? 'inline-block' : 'none';",
    "}",
    "document.getElementById('next').addEventListener('click', async () => {",
    "  if (state.currentIndex < quiz.questions.length - 1) {",
    "    state.currentIndex += 1;",
    "    renderQuestion();",
    "    await window.ActivityAPI.saveState({ currentIndex: state.currentIndex, answers: state.answers });",
    "  }",
    "});",
    "document.getElementById('prev').addEventListener('click', () => {",
    "  if (state.currentIndex > 0) { state.currentIndex -= 1; renderQuestion(); }",
    "});",
    "finishEl.addEventListener('click', async () => {",
    "  await window.ActivityAPI.complete({ score: state.score, maxScore: state.maxScore });",
    "  resultEl.textContent = 'Finished! Score: ' + state.score + '/' + state.maxScore;",
    "  statusEl.textContent = 'Completed';",
    "});",
    "window.addEventListener('message', async (event) => {",
    "  if (event.source !== window.parent) return;",
    "  if (!event.data || event.data.kind !== 'INIT') return;",
    "  runtimeInitialized = true;",
    "  statusEl.textContent = 'Initialized';",
    "  window.parent.postMessage({ kind: 'READY' }, '*');",
    "  await window.ActivityAPI.reportEvent('activity_started', { startedAt: new Date().toISOString() });",
    "  await window.ActivityAPI.saveState({ currentIndex: state.currentIndex, answers: state.answers });",
    "});",
    "if (PREVIEW) {",
    "  statusEl.textContent = 'Preview mode';",
    "  window.ActivityAPI.reportEvent('activity_started', { preview: true, startedAt: new Date().toISOString() });",
    "  window.ActivityAPI.saveState({ currentIndex: state.currentIndex, answers: state.answers });",
    "}",
    "renderQuestion();",
    "})();",
  ].join("\n");
}

export function buildQuizHtml(config: QuizDraftConfig, options?: { appScriptPath?: string; previewInline?: boolean }) {
  const appScriptPath = options?.appScriptPath ?? "app.js";
  const inline = options?.previewInline
    ? `<script>${buildQuizRuntimeScript(config, { preview: true })}</script>`
    : `<script src="${appScriptPath}"></script>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(config.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      button { padding: 8px 12px; }
      .nav { display: flex; gap: 8px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h1>${esc(config.title)}</h1>
    <p>${esc(config.instructions ?? "Answer each question and finish to submit your score.")}</p>
    <p id="status">Waiting for INIT...</p>
    <div id="app"></div>
    <div class="nav">
      <button id="prev" type="button">Previous</button>
      <button id="next" type="button">Next</button>
      <button id="finish" type="button" style="display:none;">Finish</button>
    </div>
    <p id="result"></p>
    ${inline}
  </body>
</html>`;
}
