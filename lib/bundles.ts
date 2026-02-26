import fs from "node:fs/promises";
import path from "node:path";
import type { ActivityTemplateType } from "@prisma/client";
import { buildQuizHtml, buildQuizRuntimeScript, type QuizDraftConfig } from "@/lib/templates.quiz";

const RUNTIME_ROOT = path.join(process.cwd(), "runtime-bundles");

type BuildOptions = {
  activityVersionId: string;
  entryPath?: string;
  templateType: ActivityTemplateType;
  html?: string;
  draftConfig?: QuizDraftConfig | null;
};

function defaultIndexHtml(templateType: ActivityTemplateType, customHtml?: string) {
  if (customHtml && customHtml.trim()) return customHtml;
  return `<!doctype html><html><head><meta charset="UTF-8" /><title>Activity</title></head><body><h1>${templateType} activity</h1><p>Published bundle is ready.</p></body></html>`;
}

export async function writePublishedBundle(options: BuildOptions) {
  const entryPath = options.entryPath ?? "index.html";
  const bundleDir = path.join(RUNTIME_ROOT, options.activityVersionId);
  await fs.rm(bundleDir, { recursive: true, force: true });
  await fs.mkdir(bundleDir, { recursive: true });

  const files: string[] = [entryPath];
  const entryFullPath = path.join(bundleDir, entryPath);
  await fs.mkdir(path.dirname(entryFullPath), { recursive: true });

  if (options.templateType === "quiz") {
    const draft = options.draftConfig;
    if (!draft || !draft.questions?.length) {
      throw new Error("Quiz draft config is required for quiz publishing");
    }

    await fs.writeFile(entryFullPath, buildQuizHtml(draft, { appScriptPath: "app.js" }), "utf8");
    await fs.writeFile(path.join(bundleDir, "app.js"), buildQuizRuntimeScript(draft), "utf8");
    files.push("app.js");
  } else {
    await fs.writeFile(entryFullPath, defaultIndexHtml(options.templateType, options.html), "utf8");
  }

  const manifest = {
    entryPath,
    files,
    templateType: options.templateType,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(bundleDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return {
    bundleKey: `runtime-bundles/${options.activityVersionId}`,
    entryPath,
    manifest,
  };
}
