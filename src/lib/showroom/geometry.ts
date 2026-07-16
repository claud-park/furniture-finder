import type { CellKey, EdgeKey, FloorPlan } from "./types";
import { CELL_SIZE_M, WALL_HEIGHT_M, WALL_THICKNESS_M, DOOR_HEIGHT_M } from "./types";
import { parseCellKey, parseEdgeKey } from "./edges";
import { derivePerimeter } from "./perimeter";

export interface FloorTile {
  cell: CellKey;
  /** 타일 중심 (y=0) */
  center: [number, number, number];
}

export interface WallSegment {
  edge: EdgeKey;
  center: [number, number, number];
  size: [number, number, number];
  /** lintel = 문 개구부 위 상인방 */
  kind: "wall" | "lintel";
}

export interface HouseGeometry {
  floors: FloorTile[];
  walls: WallSegment[];
  bounds: { centerX: number; centerZ: number };
}

function wallSegment(edge: EdgeKey, isDoor: boolean): WallSegment {
  const { dir, x, z } = parseEdgeKey(edge);
  // 2.4 - 2.0 은 IEEE754에서 0.3999…이 됨 — 반올림 없이는 상인방 높이가 0.4가 아니다
  const height = isDoor ? Math.round((WALL_HEIGHT_M - DOOR_HEIGHT_M) * 1e6) / 1e6 : WALL_HEIGHT_M;
  const centerY = isDoor ? DOOR_HEIGHT_M + height / 2 : height / 2;
  if (dir === "H") {
    return {
      edge,
      center: [(x + 0.5) * CELL_SIZE_M, centerY, z * CELL_SIZE_M],
      size: [CELL_SIZE_M, height, WALL_THICKNESS_M],
      kind: isDoor ? "lintel" : "wall",
    };
  }
  return {
    edge,
    center: [x * CELL_SIZE_M, centerY, (z + 0.5) * CELL_SIZE_M],
    size: [WALL_THICKNESS_M, height, CELL_SIZE_M],
    kind: isDoor ? "lintel" : "wall",
  };
}

export function buildHouseGeometry(plan: FloorPlan): HouseGeometry {
  const floors: FloorTile[] = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (const k of [...plan.cells].sort()) {
    const { x, z } = parseCellKey(k);
    floors.push({ cell: k, center: [(x + 0.5) * CELL_SIZE_M, 0, (z + 0.5) * CELL_SIZE_M] });
    minX = Math.min(minX, x * CELL_SIZE_M);
    maxX = Math.max(maxX, (x + 1) * CELL_SIZE_M);
    minZ = Math.min(minZ, z * CELL_SIZE_M);
    maxZ = Math.max(maxZ, (z + 1) * CELL_SIZE_M);
  }

  const wallEdges = new Set<EdgeKey>([...derivePerimeter(plan.cells), ...plan.walls]);
  const walls = [...wallEdges].sort().map((e) => wallSegment(e, plan.doors.has(e)));

  return {
    floors,
    walls,
    bounds: floors.length
      ? { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 }
      : { centerX: 0, centerZ: 0 },
  };
}
