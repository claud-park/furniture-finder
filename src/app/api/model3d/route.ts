import { NextRequest, NextResponse } from "next/server";
import { getModel3DProvider } from "@/lib/model3d/meshy";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 12_000_000;

/** POST { imageDataUrl } → { taskId } */
export async function POST(req: NextRequest) {
  const provider = getModel3DProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "MESHY_API_KEY 미설정" }, { status: 503 });
  }

  const ip = clientIp(req);
  if (!rateLimit(`model3d:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "이미지가 너무 커요" }, { status: 413 });
  }

  const body = (await req.json().catch(() => null)) as { imageDataUrl?: string } | null;
  if (!body?.imageDataUrl?.startsWith("data:image/")) {
    return NextResponse.json({ error: "imageDataUrl 필요" }, { status: 400 });
  }
  if (body.imageDataUrl.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "이미지가 너무 커요" }, { status: 413 });
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
