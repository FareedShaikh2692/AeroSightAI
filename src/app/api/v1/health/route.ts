import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ status: "ok", service: "aerosight-ai", mode: "demo", time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
