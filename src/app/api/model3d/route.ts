import { NextRequest, NextResponse } from "next/server";
import { getModel3DProvider } from "@/lib/model3d/meshy";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 12_000_000;

/**
 * content-length 헤더 없는 요청은 헤더 검사만으로 막을 수 없으므로, 스트림을 직접 읽으며
 * 누적 바이트 수가 한도를 넘으면 즉시 취소한다 (req.json()으로 전체를 다 읽고 나서 검사하면 늦음).
 * 반환값: 본문 문자열, 또는 한도 초과 시 null.
 */
async function readBodyCapped(req: NextRequest, maxBytes: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  let received = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null; // → 413
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** POST { imageDataUrl } → { taskId } */
export async function POST(req: NextRequest) {
  const provider = getModel3DProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "MESHY_API_KEY 미설정" }, { status: 503 });
  }

  const ip = clientIp(req);
  // x-forwarded-for는 클라이언트가 임의로 조작 가능해 per-IP 한도만으로는 우회될 수 있으므로
  // 인스턴스 전체에 대한 백스톱 한도를 함께 둔다.
  if (
    !rateLimit(`model3d:${ip}`, 10, 60 * 60 * 1000) ||
    !rateLimit("model3d:global", 30, 60 * 60 * 1000)
  ) {
    return NextResponse.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  // 저렴한 사전 체크: content-length가 있으면 스트림을 읽기 전에 바로 거른다
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "이미지가 너무 커요" }, { status: 413 });
  }

  const raw = await readBodyCapped(req, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ error: "이미지가 너무 커요" }, { status: 413 });
  }

  let body: { imageDataUrl?: string } | null;
  try {
    body = raw === "" ? null : (JSON.parse(raw) as { imageDataUrl?: string });
  } catch {
    body = null;
  }
  if (!body?.imageDataUrl?.startsWith("data:image/")) {
    return NextResponse.json({ error: "imageDataUrl 필요" }, { status: 400 });
  }
  try {
    const taskId = await provider.createTask(body.imageDataUrl);
    return NextResponse.json({ taskId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "3D 생성 요청 실패" },
      { status: 502 },
    );
  }
}

/** GET ?taskId=… → Model3DTask */
export async function GET(req: NextRequest) {
  const provider = getModel3DProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "MESHY_API_KEY 미설정" }, { status: 503 });
  }
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId 필요" }, { status: 400 });
  }
  try {
    return NextResponse.json(await provider.getTask(taskId));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "상태 조회 실패" },
      { status: 502 },
    );
  }
}
