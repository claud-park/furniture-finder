import { describe, it, expect } from "vitest";
import {
  serializeShowroom,
  deserializeShowroom,
  emptyPlan,
} from "@/lib/showroom/storage";
import type { PlacedItem } from "@/lib/showroom/types";

const item: PlacedItem = {
  id: "a1",
  source: "upload",
  title: "책상",
  widthMm: 1200,
  depthMm: 600,
  heightMm: 750,
  imageUrl: "data:image/jpeg;base64,x",
  position: [1, 0.375, 2],
  rotationY: 0,
  mount: "floor",
};

describe("showroom storage", () => {
  it("round-trips plan Sets and items", () => {
    const plan = emptyPlan();
    plan.cells.add("0,0").add("1,0");
    plan.walls.add("V:1,0");
    plan.doors.add("V:1,0");
    const out = deserializeShowroom(serializeShowroom({ plan, items: [item] }))!;
    expect(out.plan.cells).toEqual(plan.cells);
    expect(out.plan.walls).toEqual(plan.walls);
    expect(out.plan.doors).toEqual(plan.doors);
    expect(out.items).toEqual([item]);
  });

  it("normalizes stale data on load (벽 양쪽 셀이 없으면 제거)", () => {
    const plan = emptyPlan();
    plan.cells.add("0,0"); // 이웃 (1,0) 없음
    plan.walls.add("V:1,0");
    const out = deserializeShowroom(serializeShowroom({ plan, items: [] }))!;
    expect(out.plan.walls.size).toBe(0);
  });

  it("returns null for null, garbage, and wrong version", () => {
    expect(deserializeShowroom(null)).toBeNull();
    expect(deserializeShowroom("not json {")).toBeNull();
    expect(deserializeShowroom(JSON.stringify({ v: 999 }))).toBeNull();
  });

  it("emptyPlan is 24x16 with empty sets", () => {
    const p = emptyPlan();
    expect(p.cols).toBe(24);
    expect(p.rows).toBe(16);
    expect(p.cells.size).toBe(0);
  });
});
