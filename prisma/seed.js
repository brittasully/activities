const fs = require("node:fs/promises");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const runtimeRoot = path.join(process.cwd(), "runtime-bundles");

function appJsSource() {
  return `(() => {
  const statusEl = document.getElementById("status");
  const stateEl = document.getElementById("state");
  let ready = false;
  const state = { answers: {}, score: 0, maxScore: 2 };

  function reqId() { return Date.now() + "-" + Math.random().toString(36).slice(2); }

  function send(kind, payload) {
    return new Promise((resolve, reject) => {
      const requestId = reqId();
      const timeout = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("timeout"));
      }, 7000);

      function onMessage(event) {
        if (event.source !== window.parent) return;
        if (!event.data || event.data.requestId !== requestId) return;
        if (event.data.kind === "ACK") {
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          resolve(event.data.payload || { ok: true });
        } else if (event.data.kind === "ERROR") {
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          reject(new Error(event.data.error || "runtime error"));
        }
      }

      window.addEventListener("message", onMessage);
      window.parent.postMessage({ kind, requestId, payload }, "*");
    });
  }

  window.ActivityAPI = {
    reportEvent(type, payload) { return send("EVENT", { type, data: payload }); },
    saveState(stateJson) { return send("SAVE_STATE", stateJson); },
    submitAnswer(answerPayload) { return send("SUBMIT_ANSWER", answerPayload); },
    uploadArtifact(fileBlob, metadata) { return send("UPLOAD_REQUEST", { fileBlob, metadata }); },
    complete(summaryPayload) { return send("COMPLETE", summaryPayload); },
  };

  window.addEventListener("message", async (event) => {
    if (event.source !== window.parent) return;
    if (!event.data || event.data.kind !== "INIT") return;
    ready = Boolean(event.data.launchToken);
    statusEl.textContent = ready ? "Initialized and ready" : "Missing launch token";
    window.parent.postMessage({ kind: "READY" }, "*");
    if (ready) {
      await window.ActivityAPI.reportEvent("activity_started", { startedAt: new Date().toISOString() });
    }
  });

  function render() { stateEl.textContent = JSON.stringify(state, null, 2); }

  document.querySelectorAll("button[data-answer]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!ready) return;
      const idx = Array.from(document.querySelectorAll("button[data-answer]")).indexOf(button);
      const questionId = idx < 3 ? "q1" : "q2";
      const choice = Number(button.getAttribute("data-answer"));
      state.answers[questionId] = choice;
      const correct = choice === 1;
      state.score = Object.values(state.answers).filter((value) => value === 1).length;
      render();
      await window.ActivityAPI.submitAnswer({ questionId, choice, correct, score: state.score, maxScore: state.maxScore });
      await window.ActivityAPI.saveState(state);
    });
  });

  document.getElementById("finish").addEventListener("click", async () => {
    if (!ready) return;
    await window.ActivityAPI.complete({ score: state.score, maxScore: state.maxScore, completedAt: new Date().toISOString() });
    statusEl.textContent = "Activity completed";
  });

  render();
})();`;
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fractions Quick Check</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      .question { margin-bottom: 16px; }
      button { margin-top: 8px; padding: 8px 12px; }
      pre { background: #f4f4f4; padding: 8px; }
    </style>
  </head>
  <body>
    <h1>Fractions Quick Check</h1>
    <div class="question">
      <p><strong>Q1:</strong> 1/2 + 1/2 = ?</p>
      <button data-answer="0">0</button>
      <button data-answer="1">1</button>
      <button data-answer="2">2</button>
    </div>
    <div class="question">
      <p><strong>Q2:</strong> 3/4 + 1/4 = ?</p>
      <button data-answer="0">0</button>
      <button data-answer="1">1</button>
      <button data-answer="2">2</button>
    </div>
    <button id="finish">Finish Activity</button>
    <p id="status">Waiting for INIT...</p>
    <pre id="state"></pre>
    <script src="app.js"></script>
  </body>
</html>`;
}

async function writeDemoBundle(activityVersionId) {
  const dir = path.join(runtimeRoot, activityVersionId);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), indexHtml(), "utf8");
  await fs.writeFile(path.join(dir, "app.js"), appJsSource(), "utf8");
  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        entryPath: "index.html",
        files: ["index.html", "app.js"],
        templateType: "quiz",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function main() {
  await prisma.session.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.submissionEvent.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.activityVersion.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();

  const teacher = await prisma.user.create({
    data: {
      role: "teacher",
      name: "Demo Teacher",
      email: "teacher@example.com",
      passwordHash: await bcrypt.hash("password123", 10),
    },
  });

  const classroom = await prisma.class.create({
    data: {
      teacherId: teacher.id,
      name: "Period 1",
      gradeBand: "6-8",
      accessCode: "P1-2026-ABCD",
    },
  });

  const students = await Promise.all([
    prisma.user.create({ data: { role: "student", name: "Alex Rivera" } }),
    prisma.user.create({ data: { role: "student", name: "Blake Chen" } }),
    prisma.user.create({ data: { role: "student", name: "Casey Patel" } }),
  ]);

  await prisma.classStudent.createMany({
    data: students.map((student, index) => ({
      classId: classroom.id,
      studentId: student.id,
      joinCode: `JOIN-${index + 1}`,
    })),
  });

  const activity = await prisma.activity.create({
    data: {
      teacherId: teacher.id,
      title: "Fractions Quick Check",
      description: "Self-checking quiz activity for adding fractions.",
      templateType: "quiz",
      status: "published",
      draftConfigJson: {
        templateType: "quiz",
        title: "Fractions Quick Check",
        instructions: "Choose the best answer for each question.",
        questions: [
          { id: "q1", prompt: "1/2 + 1/2 = ?", choices: ["0", "1", "2", "3"], correctIndex: 1, explanation: "Two halves make one whole." },
          { id: "q2", prompt: "3/4 + 1/4 = ?", choices: ["1/2", "1", "1 1/4", "2"], correctIndex: 1, explanation: "Three quarters plus one quarter equals one whole." },
          { id: "q3", prompt: "2/3 + 1/3 = ?", choices: ["1/3", "2/3", "1", "4/3"], correctIndex: 2, explanation: "Two thirds plus one third equals one." }
        ],
      },
    },
  });

  const draftActivity = await prisma.activity.create({
    data: {
      teacherId: teacher.id,
      title: "Draft Quiz Activity",
      description: "Draft activity ready to publish from Teacher Activities page.",
      templateType: "quiz",
      status: "draft",
      draftConfigJson: {
        templateType: "quiz",
        title: "Draft Quiz Activity",
        instructions: "Edit questions then publish.",
        questions: [
          { id: "q1", prompt: "5 + 7 = ?", choices: ["10", "11", "12", "13"], correctIndex: 2, explanation: "5 + 7 is 12." },
          { id: "q2", prompt: "Capital of France?", choices: ["Paris", "Rome", "Berlin", "Madrid"], correctIndex: 0, explanation: "Paris is the capital of France." },
          { id: "q3", prompt: "Water freezes at?", choices: ["0°C", "10°C", "50°C", "100°C"], correctIndex: 0, explanation: "Pure water freezes at 0°C." }
        ],
      },
    },
  });

  const version = await prisma.activityVersion.create({
    data: {
      activityId: activity.id,
      versionNumber: 1,
      bundleKey: "runtime-bundles/pending",
      entryPath: "index.html",
      manifestJson: {},
      publishedAt: new Date(),
    },
  });

  await writeDemoBundle(version.id);

  await prisma.activityVersion.update({
    where: { id: version.id },
    data: {
      bundleKey: `runtime-bundles/${version.id}`,
      manifestJson: {
        entryPath: "index.html",
        files: ["index.html", "app.js"],
        templateType: "quiz",
        createdAt: new Date().toISOString(),
      },
    },
  });

  const assignment = await prisma.assignment.create({
    data: {
      classId: classroom.id,
      activityVersionId: version.id,
      title: "Fractions Quiz - Week 1",
      settingsJson: {
        attemptsAllowed: 1,
        showCorrectAnswers: true,
      },
    },
  });

  await prisma.submission.createMany({
    data: students.map((student) => ({
      assignmentId: assignment.id,
      studentId: student.id,
      status: "not_started",
    })),
  });

  console.log("Seed complete", {
    teacherEmail: "teacher@example.com",
    teacherPassword: "password123",
    classAccessCode: classroom.accessCode,
    studentNames: students.map((student) => student.name),
    publishedActivityVersionId: version.id,
    draftActivityId: draftActivity.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
