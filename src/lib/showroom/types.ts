/** 격자 1칸 = 0.5m × 0.5m. 가구 치수는 mm, 3D 월드 단위는 m. */
export const CELL_SIZE_MM = 500;
export const CELL_SIZE_M = 0.5;
export const WALL_HEIGHT_M = 2.4;
export const WALL_THICKNESS_M = 0.1;
export const DOOR_HEIGHT_M = 2.0;

/** "x,z" — x: 열, z: 행 (3D에서 x/z 평면에 대응) */
export type CellKey = `${number},${number}`;

/**
 * 정규화된 셀 경계(edge) 주소.
 * H:x,z — 셀 (x,z)의 북쪽 경계 (x축 방향으로 뻗음)
 * V:x,z — 셀 (x,z)의 서쪽 경계 (z축 방향으로 뻗음)
 */
export type EdgeDir = "H" | "V";
export type EdgeKey = `${EdgeDir}:${number},${number}`;

export type Side = "N" | "S" | "E" | "W";

export interface FloorPlan {
  cols: number;
  rows: number;
  /** 선택(칠해진) 바닥 셀 */
  cells: Set<CellKey>;
  /** 내부 벽만 저장 — 외곽 벽은 cells 윤곽에서 파생 */
  walls: Set<EdgeKey>;
  /** 문이 달린 edge (내부 벽 또는 외곽 edge여야 함) */
  /** 스펙의 Map<EdgeKey, DoorInfo>를 단순화 — v1은 문 메타데이터가 없어 Set으로 충분 */
  doors: Set<EdgeKey>;
}

export interface PlacedItem {
  id: string;
  source: "finder" | "upload";
  title: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** 상품 사진 or 업로드 data URL */
  imageUrl: string;
  /** AI 생성 GLB URL (있으면 박스 대신 GLTF 렌더) */
  meshUrl?: string;
  /** 월드 좌표 (m). 박스 중심점. */
  position: [number, number, number];
  rotationY: number;
  mount: "floor" | "wall";
}

/** 배치 모드에 들어갈 때의 아이템 (위치 미정) */
export type PendingItem = Omit<PlacedItem, "id" | "position" | "rotationY">;
