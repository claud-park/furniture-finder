import type { CellKey, EdgeDir, EdgeKey, Side } from "./types";

export const SIDES: readonly Side[] = ["N", "S", "E", "W"];

export const cellKey = (x: number, z: number): CellKey => `${x},${z}`;

export function parseCellKey(k: CellKey): { x: number; z: number } {
  const [x, z] = k.split(",").map(Number);
  return { x, z };
}

export const edgeKey = (dir: EdgeDir, x: number, z: number): EdgeKey =>
  `${dir}:${x},${z}`;

export function parseEdgeKey(k: EdgeKey): { dir: EdgeDir; x: number; z: number } {
  const [dir, rest] = k.split(":") as [EdgeDir, string];
  const [x, z] = rest.split(",").map(Number);
  return { dir, x, z };
}

export function neighborOf(x: number, z: number, side: Side): { x: number; z: number } {
  switch (side) {
    case "N": return { x, z: z - 1 };
    case "S": return { x, z: z + 1 };
    case "W": return { x: x - 1, z };
    case "E": return { x: x + 1, z };
  }
}

/** 셀 (x,z)의 side 방향 경계의 정규화 키 */
export function edgeOfCell(x: number, z: number, side: Side): EdgeKey {
  switch (side) {
    case "N": return edgeKey("H", x, z);
    case "S": return edgeKey("H", x, z + 1);
    case "W": return edgeKey("V", x, z);
    case "E": return edgeKey("V", x + 1, z);
  }
}

/** edge 양쪽의 두 셀 (그리드 밖일 수 있음) */
export function cellsOfEdge(k: EdgeKey): [{ x: number; z: number }, { x: number; z: number }] {
  const { dir, x, z } = parseEdgeKey(k);
  return dir === "H"
    ? [{ x, z: z - 1 }, { x, z }]
    : [{ x: x - 1, z }, { x, z }];
}
