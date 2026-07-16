import { describe, it, expect } from "vitest";
import { deriveRooms } from "@/lib/showroom/rooms";
import type { CellKey, EdgeKey } from "@/lib/showroom/types";

const cells = (...ks: CellKey[]) => new Set<CellKey>(ks);
const edges = (...ks: EdgeKey[]) => new Set<EdgeKey>(ks);

describe("deriveRooms", () => {
  it("no walls → one room", () => {
    const rooms = deriveRooms({ cells: cells("0,0", "1,0", "0,1", "1,1"), walls: edges() });
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toHaveLength(4);
  });

  it("a full wall splits 2x1 into two rooms", () => {
    const rooms = deriveRooms({ cells: cells("0,0", "1,0"), walls: edges("V:1,0") });
    expect(rooms).toHaveLength(2);
  });

  it("문이 있어도 벽은 방을 나눈다 (spec: doors still separate rooms)", () => {
    // doors는 deriveRooms 입력에 없음 — 벽 집합만으로 판단
    const rooms = deriveRooms({ cells: cells("0,0", "1,0"), walls: edges("V:1,0") });
    expect(rooms).toHaveLength(2);
  });

  it("partial wall does not split (2x2, one wall segment only)", () => {
    // (0,0)|(1,0) 사이만 벽 — 아래(0,1)~(1,1)로 돌아갈 수 있음
    const rooms = deriveRooms({
      cells: cells("0,0", "1,0", "0,1", "1,1"),
      walls: edges("V:1,0"),
    });
    expect(rooms).toHaveLength(1);
  });

  it("disconnected floor islands are separate rooms", () => {
    const rooms = deriveRooms({ cells: cells("0,0", "5,5"), walls: edges() });
    expect(rooms).toHaveLength(2);
  });

  it("empty plan → no rooms", () => {
    expect(deriveRooms({ cells: cells(), walls: edges() })).toHaveLength(0);
  });
});
