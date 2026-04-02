export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// MediaMTX WHEP endpoint — Vast.ai maps internal :6006 → external :53144
const MEDIAMTX_BASE = process.env.MEDIAMTX_WHEP_URL || "http://1.208.108.242:53144";

// Vast.ai NAT port mapping: internal → external
// MediaMTX announces internal ports in ICE candidates; we rewrite to external
const PORT_MAP: Record<string, string> = {
  "8888": process.env.MEDIAMTX_ICE_TCP_PORT || "53189",
};

function rewriteIcePorts(sdp: string): string {
  // Rewrite ICE candidate lines: replace internal ports with external NAT ports
  return sdp.replace(/^a=candidate:(.+?) (\d+) tcp (.+)$/gm, (line, prefix, port, rest) => {
    const mapped = PORT_MAP[port];
    if (mapped) {
      return `a=candidate:${prefix} ${mapped} tcp ${rest}`;
    }
    return line;
  });
}

export async function POST(request: NextRequest) {
  const streamId = request.nextUrl.searchParams.get("stream");
  if (!streamId) {
    return NextResponse.json({ error: "stream required" }, { status: 400 });
  }

  const sdp = await request.text();

  try {
    const res = await fetch(`${MEDIAMTX_BASE}/${streamId}/whep`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: sdp,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[WHEP] MediaMTX error ${res.status}: ${errText}`);
      return new NextResponse(errText, { status: res.status });
    }

    // Rewrite ICE candidate ports for Vast.ai NAT
    const answer = rewriteIcePorts(await res.text());
    const headers = new Headers();
    headers.set("Content-Type", "application/sdp");
    headers.set("Access-Control-Allow-Origin", "*");
    const location = res.headers.get("location");
    if (location) headers.set("Location", location);

    return new NextResponse(answer, { status: 201, headers });
  } catch (err) {
    console.error("[WHEP] Proxy error:", err);
    return NextResponse.json({ error: "MediaMTX unreachable" }, { status: 502 });
  }
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
