import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters";
import { computeMatchStatus } from "@/lib/dimensions";
import type { FurnitureCategory, FurnitureQuery, SearchResponse } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/search?source=ikea&category=desk&w=1200&d=600&h=750&tol=5
 * w/d/h 단위: mm (선택), tol: 허용 오차 %
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const adapter = getAdapter(sp.get("source") ?? "");
  if (!adapter) {
    return NextResponse.json({ error: "unknown source" }, { status: 400 });
  }

  const numParam = (k: string) => {
    const v = sp.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const query: FurnitureQuery = {
    category: (sp.get("category") ?? "desk") as FurnitureCategory,
    maxWidth: numParam("w"),
    maxDepth: numParam("d"),
    maxHeight: numParam("h"),
    tolerancePct: numParam("tol") ?? 0,
  };

  const base: Pick<SearchResponse, "source" | "sourceName"> = {
    source: adapter.id,
    sourceName: adapter.name,
  };

  if (!adapter.isConfigured()) {
    return NextResponse.json({
      ...base,
      status: "unconfigured",
      items: [],
      unverified: [],
    } satisfies SearchResponse);
  }

  try {
    const found = await adapter.search(query);
    const items: SearchResponse["items"] = [];
    const unverified: SearchResponse["unverified"] = [];

    for (const item of found) {
      const status = computeMatchStatus(item.dimensions, item.confidence, query);
      if (status === "exceeds") continue; // 최대 허용 치수 초과 → 제외
      if (status === "unknown") unverified.push({ ...item, matchStatus: "unknown" });
      else items.push({ ...item, matchStatus: status });
    }

    return NextResponse.json({
      ...base,
      status: "ok",
      items,
      unverified,
    } satisfies SearchResponse);
  } catch (err) {
    return NextResponse.json({
      ...base,
      status: "error",
      items: [],
      unverified: [],
      error: err instanceof Error ? err.message : "search failed",
    } satisfies SearchResponse);
  }
}
