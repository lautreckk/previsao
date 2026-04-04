export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// Proxy HLS stream to avoid CORS/SSL issues and improve reliability
// Usage: /api/camera/stream?cam=SP055-KM110B
//        /api/camera/stream?cam=SP055-KM110B&seg=stream0.ts

const STREAM_BASE = "https://34.104.32.249.nip.io";

export async function GET(request: NextRequest) {
  const cam = request.nextUrl.searchParams.get("cam");
  const seg = request.nextUrl.searchParams.get("seg");

  if (!cam) {
    return NextResponse.json({ error: "cam required" }, { status: 400 });
  }

  // Sanitize cam and seg to prevent path traversal
  if (/[^a-zA-Z0-9_\-]/.test(cam) || (seg && /[^a-zA-Z0-9_\-\.]/.test(seg))) {
    return NextResponse.json({ error: "Invalid parameter" }, { status: 400 });
  }

  try {
    let url: string;
    let contentType: string;

    if (seg) {
      // Fetch a specific segment (.ts file)
      url = `${STREAM_BASE}/${cam}/${seg}`;
      contentType = "video/mp2t";
    } else {
      // Fetch the m3u8 manifest
      url = `${STREAM_BASE}/${cam}/stream.m3u8`;
      contentType = "application/vnd.apple.mpegurl";
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      // @ts-expect-error - Next.js fetch cache option
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse(`Stream error: ${res.status}`, { status: res.statusCode || 502 });
    }

    if (seg) {
      // Binary segment — stream through
      const body = await res.arrayBuffer();
      return new NextResponse(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=2",
          "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "https://previsao-tau.vercel.app",
        },
      });
    } else {
      // M3U8 manifest — rewrite segment URLs to go through our proxy
      let manifest = await res.text();
      // Replace relative .ts URLs with our proxy URLs
      manifest = manifest.replace(
        /^([^\s#][^\s]*\.ts.*)$/gm,
        (match) => `/api/camera/stream?cam=${cam}&seg=${encodeURIComponent(match)}`
      );
      return new NextResponse(manifest, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "https://previsao-tau.vercel.app",
        },
      });
    }
  } catch (error) {
    console.error("[stream proxy]", error);
    return new NextResponse("Stream proxy error", { status: 502 });
  }
}
