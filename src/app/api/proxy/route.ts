import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // GLB 여유 포함 50MB

/** 외부 이미지/GLB를 동일 출처로 중계해 CORS/텍스처 오염을 피한다. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  try {
    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }
    const len = Number(upstream.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) {
      return NextResponse.json({ error: "too large" }, { status: 413 });
    }
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
