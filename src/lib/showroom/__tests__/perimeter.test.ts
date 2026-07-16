import { describe, it, expect } from "vitest";
import { derivePerimeter, normalizePlan } from "@/lib/showroom/perimeter";
import type { CellKey, EdgeKey, FloorPlan } from "@/lib/showroom/types";

const cells = (...ks: CellKey[]) => new Set<CellKey>(ks);
const edges = (...ks: EdgeKey[]) => new Set<EdgeKey>(ks);

describe("derivePerimeter", () => {
  it("single cell has 4 perimeter edges", () => {
    expect(derivePerimeter(cells("0,0"))).toEqual(
      edges("H:0,0", "H:0,1", "V:0,0", "V:1,0"),
    );
  });

  it("2x1 horizontal strip has 6 edges, shared edge excluded", () => {
    const p = derivePerimeter(cells("0,0", "1,0"));
    expect(p.size).toBe(6);
    expect(p.has("V:1,0")).toBe(false); // 두 셀 사이 edge는 외곽이 아님
  });

  it("disconnected islands each get their own perimeter", () => {
    const p = derivePerimeter(cells("0,0", "5,5"));
    expect(p.size).toBe(8);
  });

  it("empty set → empty perimeter", () => {
    expect(derivePerimeter(cells()).size).toBe(0);
  });
});

describe("normalizePlan", () => {
  const base: FloorPlan = {
    cols: 8,
    rows: 8,
    cells: cells("0,0", "1,0"),
    walls: edges(),
    doors: edges(),
  };

  it("keeps interior wall between two selected cells", () => {
    const plan = { ...base, walls: edges("V:1,0") };
    expect(normalizePlan(plan).walls.has("V:1,0")).toBe(true);
  });

  it("drops wall whose neighbor cell is unselected", () => {
    const plan = { ...base, walls: edges("V:2,0") }; // (2,0) 미선택
    expect(normalizePlan(plan).walls.size).toBe(0);
  });

  it("keeps door on interior wall and on perimeter, drops door on nothing", () => {
    const plan = {
      ...base,
      walls: edges("V:1,0"),
      doors: edges("V:1,0", "H:0,0", "H:5,5"),
    };
    const n = normalizePlan(plan);
    expect(n.doors.has("V:1,0")).toBe(true); // 내부 벽 위
    expect(n.doors.has("H:0,0")).toBe(true); // 외곽 벽 위 (현관)
    expect(n.doors.has("H:5,5")).toBe(false); // 벽 없는 곳
  });
});
