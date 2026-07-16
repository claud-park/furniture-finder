import { describe, it, expect } from "vitest";
import { buildHouseGeometry } from "@/lib/showroom/geometry";
import type { CellKey, EdgeKey, FloorPlan } from "@/lib/showroom/types";

function plan(overrides: Partial<FloorPlan>): FloorPlan {
  return {
    cols: 8,
    rows: 8,
    cells: new Set<CellKey>(),
    walls: new Set<EdgeKey>(),
    doors: new Set<EdgeKey>(),
    ...overrides,
  };
}

describe("buildHouseGeometry", () => {
  it("single cell → 1 floor tile at world center (0.25, 0, 0.25), 4 walls", () => {
    const g = buildHouseGeometry(plan({ cells: new Set<CellKey>(["0,0"]) }));
    expect(g.floors).toHaveLength(1);
    expect(g.floors[0].center).toEqual([0.25, 0, 0.25]);
    expect(g.walls).toHaveLength(4);
    expect(g.walls.every((w) => w.kind === "wall")).toBe(true);
  });

  it("H-edge wall geometry: runs along x, thin in z", () => {
    const g = buildHouseGeometry(plan({ cells: new Set<CellKey>(["0,0"]) }));
    const north = g.walls.find((w) => w.edge === "H:0,0")!;
    expect(north.center).toEqual([0.25, 1.2, 0]);
    expect(north.size).toEqual([0.5, 2.4, 0.1]);
  });

  it("V-edge wall geometry: runs along z, thin in x", () => {
    const g = buildHouseGeometry(plan({ cells: new Set<CellKey>(["0,0"]) }));
    const west = g.walls.find((w) => w.edge === "V:0,0")!;
    expect(west.center).toEqual([0, 1.2, 0.25]);
    expect(west.size).toEqual([0.1, 2.4, 0.5]);
  });

  it("interior wall included; door edge becomes a lintel (개구부 위 상인방)", () => {
    const g = buildHouseGeometry(
      plan({
        cells: new Set<CellKey>(["0,0", "1,0"]),
        walls: new Set<EdgeKey>(["V:1,0"]),
        doors: new Set<EdgeKey>(["V:1,0"]),
      }),
    );
    const seg = g.walls.find((w) => w.edge === "V:1,0")!;
    expect(seg.kind).toBe("lintel");
    expect(seg.center).toEqual([0.5, 2.2, 0.25]); // y = (2.0+2.4)/2
    expect(seg.size).toEqual([0.1, 0.4, 0.5]); // 남은 높이 0.4m
  });

  it("bounds center is the centroid of floor extents", () => {
    const g = buildHouseGeometry(plan({ cells: new Set<CellKey>(["0,0", "1,0"]) }));
    expect(g.bounds.centerX).toBeCloseTo(0.5);
    expect(g.bounds.centerZ).toBeCloseTo(0.25);
  });

  it("empty plan → empty geometry, no crash", () => {
    const g = buildHouseGeometry(plan({}));
    expect(g.floors).toHaveLength(0);
    expect(g.walls).toHaveLength(0);
  });
});
