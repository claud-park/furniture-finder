import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // GLB 여유 포함 50MB

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** IPv4 옥텟(a.b.*.*)이 루프백/링크로컬(메타데이터)/사설 대역에 속하는지 판정한다. */
function isForbiddenV4(a: number, b: number): boolean {
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local/metadata
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  return false;
}

/** localhost/.local, 루프백·링크로컬(메타데이터)·사설 대역 호스트를 차단해 SSRF를 막는다. */
function isForbiddenHost(hostname: string): boolean {
  // URL.hostname은 IPv6 리터럴을 대괄호 포함 형태(예: "[::1]")로 반환하므로 벗겨낸다
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local")) return true;

  const v4 = host.match(IPV4_RE);
  if (v4) {
    return isForbiddenV4(Number(v4[1]), Number(v4[2]));
  }

  // IPv6 리터럴
  if (host === "::1") return true; // loopback

  // IPv4-매핑 IPv6 (::ffff:a.b.c.d 또는 정규화된 ::ffff:xxxx:yyyy 16진 그룹 형태)
  const mapped = host.match(/^::ffff:(.+)$/);
  if (mapped) {
    const rest = mapped[1];
    const dotted = rest.match(IPV4_RE);
    if (dotted) {
      return isForbiddenV4(Number(dotted[1]), Number(dotted[2]));
    }
    const hexParts = rest.split(":");
    if (hexParts.length === 2 && hexParts.every((p) => /^[0-9a-f]{1,4}$/.test(p))) {
      // 상위 16비트 그룹이 a.b 옥텟에 해당 (예: 127.0.0.1 -> "7f00:1" -> a=0x7f, b=0x00)
      const g1 = parseInt(hexParts[0], 16);
      return isForbiddenV4((g1 >> 8) & 0xff, g1 & 0xff);
    }
  }

  const firstGroup = host.split(":")[0];
  if (/^[0-9a-f]{1,4}$/.test(firstGroup)) {
    const g = parseInt(firstGroup, 16);
    if ((g & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  }
  return false;
}

/** http(s) 스킴이고 금지된 호스트가 아니면 파싱된 URL을, 아니면 null을 반환한다. */
function parseAllowedUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (isForbiddenHost(parsed.hostname)) return null;
  return parsed;
}

/** 외부 이미지/GLB를 동일 출처로 중계해 CORS/텍스처 오염을 피한다. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const parsed = url ? parseAllowedUrl(url) : null;
  if (!parsed) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  try {
    const upstream = await fetch(parsed.toString(), { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }

    // 리다이렉트가 금지된 호스트로 이어졌는지 최종 URL로 재검증
    let finalUrl: URL;
    try {
      finalUrl = new URL(upstream.url);
    } catch {
      return NextResponse.json({ error: "forbidden redirect target" }, { status: 502 });
    }
    if (!/^https?:$/.test(finalUrl.protocol) || isForbiddenHost(finalUrl.hostname)) {
      return NextResponse.json({ error: "forbidden redirect target" }, { status: 502 });
    }

    const len = Number(upstream.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) {
      return NextResponse.json({ error: "too large" }, { status: 413 });
    }

    // content-length 헤더가 없거나 거짓일 수 있으므로 스트리밍 중에도 바이트 수를 강제한다
    let received = 0;
    const limiter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_BYTES) {
          controller.error(new Error("too large"));
          return;
        }
        controller.enqueue(chunk);
      },
    });

    return new NextResponse(upstream.body.pipeThrough(limiter), {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
