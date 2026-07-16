import type { CellKey, FloorPlan } from "./types";
import { SIDES, cellKey, parseCellKey, neighborOf, edgeOfCell } from "./edges";

/**
 * 벽을 경계로 한 flood-fill로 방을 파생한다.
 * 문이 있는 벽도 벽 — 문은 3D 개구부일 뿐 방을 합치지 않는다.
 */
export function deriveRooms(plan: Pick<FloorPlan, "cells" | "walls">): CellKey[][] {
  const { cells, walls } = plan;
  const visited = new Set<CellKey>();
  const rooms: CellKey[][] = [];

  for (const start of [...cells].sort()) {
    if (visited.has(start)) continue;
    const room: CellKey[] = [];
    const queue: CellKey[] = [start];
    visited.add(start);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      room.push(cur);
      const { x, z } = parseCellKey(cur);
      for (const side of SIDES) {
        const n = neighborOf(x, z, side);
        const nk = cellKey(n.x, n.z);
        if (!cells.has(nk) || visited.has(nk)) continue;
        if (walls.has(edgeOfCell(x, z, side))) continue; // 벽 = 장벽
        visited.add(nk);
        queue.push(nk);
      }
    }
    rooms.push(room.sort());
  }
  return rooms;
}
