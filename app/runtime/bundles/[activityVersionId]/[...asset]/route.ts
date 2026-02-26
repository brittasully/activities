import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    activityVersionId: string;
    asset: string[];
  };
};

const RUNTIME_ROOT = path.join(process.cwd(), "runtime-bundles");

function contentTypeFor(filePath: string) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function runtimeCsp() {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export async function GET(_req: Request, { params }: RouteContext) {
  const activityVersion = await prisma.activityVersion.findFirst({
    where: {
      id: params.activityVersionId,
      publishedAt: { not: null },
    },
    select: {
      id: true,
      entryPath: true,
    },
  });

  if (!activityVersion) {
    return NextResponse.json({ error: "Published activity version not found" }, { status: 404 });
  }

  const assetParts = params.asset?.length ? params.asset : [activityVersion.entryPath];
  const requestedPath = path.normalize(assetParts.join("/"));
  if (requestedPath.startsWith("..") || path.isAbsolute(requestedPath)) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 });
  }

  const bundleDir = path.resolve(path.join(RUNTIME_ROOT, activityVersion.id));
  const resolved = path.resolve(path.join(bundleDir, requestedPath));

  if (!resolved.startsWith(bundleDir)) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 });
  }

  try {
    const body = await fs.readFile(resolved);
    const headers: Record<string, string> = {
      "content-type": contentTypeFor(resolved),
      "x-content-type-options": "nosniff",
    };

    if (resolved.endsWith(".html")) {
      headers["content-security-policy"] = runtimeCsp();
    }

    return new NextResponse(body, {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
}
