export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// Vast.ai instance (Quebec, CA) — WebRTC port not yet exposed
// TODO: expose port 8889 on Vast.ai instance for WebRTC
const MEDIAMTX_BASE = process.env.MEDIAMTX_WHEP_URL || "http://82.25.68.62:8889";

export async function POST(request: NextRequest) {
  const streamId = request.nextUrl.searchParams.get("stream");
  if (!streamId) {
    return NextResponse.json({ error: "stream required" }, { status: 400 });
  }

  const sdp = await request.text();

  const res = await fetch(`${MEDIAMTX_BASE}/${streamId}/whep`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: sdp,
  });

  if (!res.ok) {
    return new NextResponse(await res.text(), { status: res.status });
  }

  const answer = await res.text();
  const headers = new Headers();
  headers.set("Content-Type", "application/sdp");
  // Forward Location header (needed for WHEP resource URL)
  const location = res.headers.get("location");
  if (location) headers.set("Location", location);

  return new NextResponse(answer, { status: 201, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
