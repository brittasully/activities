import { NextResponse } from "next/server";
import { clearSessionCookieAndRecord } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  await clearSessionCookieAndRecord(response);
  return response;
}
