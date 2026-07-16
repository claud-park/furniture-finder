import type { CellKey, EdgeKey, FloorPlan } from "./types";
import { SIDES, cellKey, parseCellKey, neighborOf, edgeOfCell, cellsOfEdge } from "./edges";

/** 선택 셀 윤곽에서 외곽 벽 edge를 파생 (저장하지 않음) */
export function derivePerimeter(cells: Set<CellKey>): Set<EdgeKey> {
  const out = new Set<EdgeKey>();
  for (const k of cells) {
    const { x, z } = parseCellKey(k);
    for (const side of SIDES) {
      const n = neighborOf(x, z, side);
      if (!cells.has(cellKey(n.x, n.z))) out.add(edgeOfCell(x, z, side));
    }
  }
  return out;
}

/**
 * 무결성 보정: 내부 벽은 양쪽 셀이 모두 선택되어야 하고,
 * 문은 내부 벽 또는 외곽 edge 위에만 존재할 수 있다.
 */
export function normalizePlan(plan: FloorPlan): FloorPlan {
  const walls = new Set<EdgeKey>();
  for (const e of plan.walls) {
    const [a, b] = cellsOfEdge(e);
    if (plan.cells.has(cellKey(a.x, a.z)) && plan.cells.has(cellKey(b.x, b.z))) {
      walls.add(e);
    }
  }
  const perimeter = derivePerimeter(plan.cells);
  const doors = new Set<EdgeKey>();
  for (const e of plan.doors) {
    if (walls.has(e) || perimeter.has(e)) doors.add(e);
  }
  return { ...plan, walls, doors };
}
