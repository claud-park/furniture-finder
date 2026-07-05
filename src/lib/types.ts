/** 기준 단위: mm */
export interface Dimensions {
  width?: number;
  depth?: number;
  height?: number;
}

/**
 * exact     — W/D/H가 명시적으로 매핑됨
 * estimated — 2개 치수만 있어 width×depth로 추정하는 등 불확실성 존재
 * unknown   — 치수 파싱 실패
 */
export type DimensionConfidence = "exact" | "estimated" | "unknown";

/** 카드 뱃지: ✅ fit / ⚠️ estimated fit / ❓ 치수 미확인 */
export type MatchStatus = "fit" | "estimated" | "unknown";

export type SourceId = "ikea" | "coupang" | "ohou" | "muji";

export type FurnitureCategory =
  | "desk"
  | "bookshelf"
  | "cabinet"
  | "chair"
  | "table"
  | "sofa"
  | "bed"
  | "drawer";

export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  desk: "책상",
  bookshelf: "책장",
  cabinet: "수납장",
  chair: "의자",
  table: "테이블",
  sofa: "소파",
  bed: "침대",
  drawer: "서랍장",
};

/** 입력값은 "최대 허용 치수" (공간에 들어가야 함). 단위: mm */
export interface FurnitureQuery {
  category: FurnitureCategory;
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
  /** 허용 오차 %. 0 = 정확히 이하, 5 = +5% 허용 */
  tolerancePct: number;
}

export interface FurnitureItem {
  id: string;
  source: SourceId;
  title: string;
  url: string;
  imageUrl?: string;
  /** KRW. 없으면 미표시 */
  price?: number;
  dimensions?: Dimensions;
  confidence: DimensionConfidence;
  /** 검색 결과의 원문 치수 텍스트 (디버깅/표시용) */
  rawDimensionText?: string;
}

export interface SourceAdapter {
  id: SourceId;
  name: string;
  /** API 키 미설정 등으로 검색 불가하면 false — UI에 "미설정" 뱃지 */
  isConfigured(): boolean;
  search(query: FurnitureQuery): Promise<FurnitureItem[]>;
}

/** /api/search 응답 (소스 1개 단위) */
export interface SearchResponse {
  source: SourceId;
  sourceName: string;
  status: "ok" | "unconfigured" | "error";
  /** 치수 조건에 맞는 상품 (fit/estimated) */
  items: (FurnitureItem & { matchStatus: MatchStatus })[];
  /** 치수 파싱 실패 → "치수 확인 필요" 섹션 */
  unverified: (FurnitureItem & { matchStatus: MatchStatus })[];
  error?: string;
}
