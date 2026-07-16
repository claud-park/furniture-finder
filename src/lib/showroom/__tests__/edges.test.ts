import { describe, it, expect } from "vitest";
import {
  cellKey,
  parseCellKey,
  edgeKey,
  parseEdgeKey,
  neighborOf,
  edgeOfCell,
  cellsOfEdge,
} from "@/lib/showroom/edges";

describe("cell/edge keys", () => {
  it("round-trips cell keys", () => {
    expect(cellKey(3, 7)).toBe("3,7");
    expect(parseCellKey("3,7")).toEqual({ x: 3, z: 7 });
  });

  it("round-trips edge keys", () => {
    expect(edgeKey("H", 2, 5)).toBe("H:2,5");
    expect(parseEdgeKey("V:0,1")).toEqual({ dir: "V", x: 0, z: 1 });
  });
});

describe("edgeOfCell — 인접한 두 셀은 같은 물리 edge에 대해 같은 키를 얻는다", () => {
  it("south edge of (x,z) === north edge of (x,z+1)", () => {
    expect(edgeOfCell(2, 3, "S")).toBe(edgeOfCell(2, 4, "N"));
    expect(edgeOfCell(2, 3, "S")).toBe("H:2,4");
  });

  it("east edge of (x,z) === west edge of (x+1,z)", () => {
    expect(edgeOfCell(2, 3, "E")).toBe(edgeOfCell(3, 3, "W"));
    expect(edgeOfCell(2, 3, "E")).toBe("V:3,3");
  });
});

describe("neighborOf", () => {
  it("returns the adjacent cell per side", () => {
    expect(neighborOf(2, 3, "N")).toEqual({ x: 2, z: 2 });
    expect(neighborOf(2, 3, "S")).toEqual({ x: 2, z: 4 });
    expect(neighborOf(2, 3, "W")).toEqual({ x: 1, z: 3 });
    expect(neighborOf(2, 3, "E")).toEqual({ x: 3, z: 3 });
  });
});

describe("cellsOfEdge — edge 양쪽의 두 셀", () => {
  it("H edge separates (x,z-1) and (x,z)", () => {
    expect(cellsOfEdge("H:2,4")).toEqual([
      { x: 2, z: 3 },
      { x: 2, z: 4 },
    ]);
  });

  it("V edge separates (x-1,z) and (x,z)", () => {
    expect(cellsOfEdge("V:3,3")).toEqual([
      { x: 2, z: 3 },
      { x: 3, z: 3 },
    ]);
  });
});
