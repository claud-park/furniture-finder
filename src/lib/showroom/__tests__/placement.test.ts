import { describe, it, expect } from "vitest";
import { floorPosition, wallPlacement, fitScale } from "@/lib/showroom/placement";

describe("floorPosition", () => {
  it("centers the box at hit x/z with y = height/2 in meters", () => {
    expect(floorPosition([1.5, 0, 2.0], { heightMm: 750 })).toEqual([1.5, 0.375, 2.0]);
  });
});

describe("wallPlacement", () => {
  it("+x normal wall: offsets by depth/2 along x, faces +x", () => {
    const r = wallPlacement([2, 1.0, 3], [1, 0, 0], { depthMm: 200 });
    expect(r.position).toEqual([2.1, 1.0, 3]);
    expect(r.rotationY).toBeCloseTo(Math.PI / 2);
  });

  it("+z normal wall: offsets along z, rotationY 0", () => {
    const r = wallPlacement([2, 1.2, 3], [0, 0, 1], { depthMm: 300 });
    expect(r.position).toEqual([2, 1.2, 3.15]);
    expect(r.rotationY).toBeCloseTo(0);
  });

  it("-z normal wall: rotationY π", () => {
    const r = wallPlacement([2, 1.2, 3], [0, 0, -1], { depthMm: 300 });
    expect(r.position).toEqual([2, 1.2, 2.85]);
    expect(Math.abs(r.rotationY)).toBeCloseTo(Math.PI);
  });
});

describe("fitScale", () => {
  it("scales a unit bbox to real dims in meters", () => {
    expect(fitScale([1, 1, 1], { widthMm: 1000, depthMm: 500, heightMm: 2000 })).toEqual([
      1, 2, 0.5,
    ]); // [x=width, y=height, z=depth]
  });

  it("guards zero bbox axes with scale 1", () => {
    expect(fitScale([0, 2, 1], { widthMm: 1000, depthMm: 500, heightMm: 1000 })).toEqual([
      1, 0.5, 0.5,
    ]);
  });
});
