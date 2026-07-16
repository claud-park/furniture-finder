import { NextRequest, NextResponse } from "next/server";
import { getModel3DProvider } from "@/lib/model3d/meshy";

export const runtime = "nodejs";

/** POST { imageDataUrl } → { taskId } */
export async function POST(req: NextRequest) {
  const provider = getModel3DProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "MESHY_API_KEY 미설정" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { imageDataUrl?: string } | null;
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
