import { NextResponse } from "next/server";
import { adapters } from "@/lib/adapters";

export const runtime = "nodejs";

/** GET /api/sources — 등록된 소스와 설정 여부 (탭/뱃지 구성용) */
export async function GET() {
  return NextResponse.json({
    sources: adapters.map((a) => ({
      id: a.id,
      name: a.name,
      configured: a.isConfigured(),
    })),
  });
}
