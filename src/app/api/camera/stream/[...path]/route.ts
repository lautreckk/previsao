export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// MediaMTX HLS endpoint — Vast.ai BR, internal :8384 → external :42817
const MEDIAMTX_HLS = process.env.MEDIAMTX_HLS_URL || "http://189.79.25.23:42817";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const subpath = path.join("/");
  const url = `${MEDIAMTX_HLS}/${subpath}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: request.headers.get("Accept") || "*/*" },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[HLS Proxy] Error:", err);
    return NextResponse.json({ error: "stream unavailable" }, { status: 502 });
  }
}
