import type {
  DimensionConfidence,
  Dimensions,
  FurnitureQuery,
  MatchStatus,
} from "./types";

export interface ParsedDimensions {
  dimensions?: Dimensions;
  confidence: DimensionConfidence;
  /** 매칭된 원문 조각 */
  raw?: string;
}

type Unit = "mm" | "cm" | "m";

const UNIT_FACTOR: Record<Unit, number> = { mm: 1, cm: 10, m: 1000 };

/** 가구 치수로 유효한 범위(mm) — 벗어나면 오파싱으로 간주 */
const MIN_MM = 10;
const MAX_MM = 5000;

function toMm(value: number, unit: Unit | undefined, assumeCmBelow = 400): number {
  if (unit) return Math.round(value * UNIT_FACTOR[unit]);
  // 단위 없음: 400 미만이면 cm 관례(예: "120x60 책상"), 이상이면 mm 가정
  return Math.round(value < assumeCmBelow ? value * 10 : value);
}

function valid(mm: number): boolean {
  return mm >= MIN_MM && mm <= MAX_MM;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(mm|cm|m)?`;
const SEP = String.raw`\s*[x×*X]\s*`;

/** 라벨 → 축 매핑 (한국어/영문). 단문자 라벨(W/D/H)은 단어 경계 강제 */
const axisRe = (labels: string) =>
  new RegExp(
    String.raw`(?<![A-Za-z])(?:${labels})(?![A-Za-z])\s*:?\s*${NUM}\s*${UNIT}`,
    "i",
  );
const AXIS_LABELS: Array<[keyof Dimensions, RegExp]> = [
  ["width", axisRe("W|width|가로|폭|너비")],
  ["depth", axisRe("D|depth|세로|깊이")],
  ["height", axisRe("H|height|높이")],
];

const TRIPLE_RE = new RegExp(
  String.raw`${NUM}\s*${UNIT}${SEP}${NUM}\s*${UNIT}${SEP}${NUM}\s*${UNIT}`,
);
const DOUBLE_RE = new RegExp(String.raw`${NUM}\s*${UNIT}${SEP}${NUM}\s*${UNIT}`);

function num(s: string): number {
  return parseFloat(s.replace(",", "."));
}

/**
 * 상품명/설명 텍스트에서 치수를 추출해 mm로 정규화.
 * 지원: `1200x600x750`, `1200*600*750`, `1200×600`, `120x60cm`,
 *       `W1200 D600 H750`, `가로 120cm`, `폭 80cm`, `높이 1800mm`
 */
export function parseDimensions(text: string | undefined | null): ParsedDimensions {
  if (!text) return { confidence: "unknown" };

  // 1) 라벨 기반 (W/D/H, 가로/세로/높이 …) — 가장 신뢰도 높음
  const labeled: Dimensions = {};
  const rawParts: string[] = [];
  for (const [axis, re] of AXIS_LABELS) {
    const m = text.match(re);
    if (m) {
      const mm = toMm(num(m[1]), (m[2]?.toLowerCase() as Unit) || undefined);
      if (valid(mm)) {
        labeled[axis] = mm;
        rawParts.push(m[0]);
      }
    }
  }
  const labeledCount = Object.keys(labeled).length;
  if (labeledCount >= 2) {
    return { dimensions: labeled, confidence: "exact", raw: rawParts.join(" ") };
  }

  // 2) NxNxN — W×D×H로 해석
  const t = text.match(TRIPLE_RE);
  if (t) {
    // 하나라도 단위가 명시되면 나머지 무단위 값에도 같은 단위 적용
    const sharedUnit = (t[2] || t[4] || t[6])?.toLowerCase() as Unit | undefined;
    const mk = (v: string, u: string | undefined) =>
      sharedUnit ? Math.round(num(v) * UNIT_FACTOR[(u?.toLowerCase() as Unit) || sharedUnit]) : toMm(num(v), undefined);
    const dims: Dimensions = {
      width: mk(t[1], t[2]),
      depth: mk(t[3], t[4]),
      height: mk(t[5], t[6]),
    };
    if ([dims.width!, dims.depth!, dims.height!].every(valid)) {
      return { dimensions: dims, confidence: "exact", raw: t[0] };
    }
  }

  // 3) NxN — width×depth 추정
  const d = text.match(DOUBLE_RE);
  if (d) {
    const sharedUnit = (d[2] || d[4])?.toLowerCase() as Unit | undefined;
    const mk = (v: string, u: string | undefined) =>
      sharedUnit ? Math.round(num(v) * UNIT_FACTOR[(u?.toLowerCase() as Unit) || sharedUnit]) : toMm(num(v), undefined);
    const dims: Dimensions = { width: mk(d[1], d[2]), depth: mk(d[3], d[4]) };
    if ([dims.width!, dims.depth!].every(valid)) {
      return { dimensions: dims, confidence: "estimated", raw: d[0] };
    }
  }

  // 4) 라벨 1개만 발견된 경우 (예: "높이 1800mm" 만)
  if (labeledCount === 1) {
    return { dimensions: labeled, confidence: "estimated", raw: rawParts.join(" ") };
  }

  return { confidence: "unknown" };
}

/**
 * 매칭 판정. 입력값은 최대 허용 치수.
 * 반환 "exceeds"는 결과에서 제외, "unknown"은 "치수 확인 필요" 섹션.
 */
export function computeMatchStatus(
  dimensions: Dimensions | undefined,
  confidence: DimensionConfidence,
  query: FurnitureQuery,
): MatchStatus | "exceeds" {
  if (!dimensions || confidence === "unknown") return "unknown";

  const factor = 1 + query.tolerancePct / 100;
  const constraints: Array<[number | undefined, number | undefined]> = [
    [query.maxWidth, dimensions.width],
    [query.maxDepth, dimensions.depth],
    [query.maxHeight, dimensions.height],
  ];

  let verified = 0;
  let unverifiable = 0;
  for (const [max, actual] of constraints) {
    if (max === undefined) continue; // 사용자가 제한하지 않은 축
    if (actual === undefined) {
      unverifiable++;
      continue;
    }
    if (actual > max * factor) return "exceeds";
    verified++;
  }

  if (verified === 0) return "unknown"; // 제약된 축을 하나도 확인 못 함
  if (unverifiable > 0 || confidence === "estimated") return "estimated";
  return "fit";
}
