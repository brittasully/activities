import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: "Upload URL flow is not implemented yet in MVP.",
  }, { status: 501 });
}
