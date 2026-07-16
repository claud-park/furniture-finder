"use client";

import { useMemo, useState } from "react";
import type { CellKey, EdgeKey, FloorPlan } from "@/lib/showroom/types";
import { cellKey, edgeKey, parseEdgeKey } from "@/lib/showroom/edges";
import { derivePerimeter, normalizePlan } from "@/lib/showroom/perimeter";
import { deriveRooms } from "@/lib/showroom/rooms";

type Tool = "floor" | "wall" | "door" | "erase";

const CELL_PX = 28;
const TOOLS: { id: Tool; label: string }[] = [
  { id: "floor", label: "바닥" },
  { id: "wall", label: "벽" },
  { id: "door", label: "문" },
  { id: "erase", label: "지우개" },
];

interface Props {
  plan: FloorPlan;
  onChange: (plan: FloorPlan) => void;
  onDone: () => void;
}

export default function FloorPlanEditor({ plan, onChange, onDone }: Props) {
  const [tool, setTool] = useState<Tool>("floor");
  // 드래그 페인트: pointerdown 시 결정된 값(추가/제거)을 유지
  const [paint, setPaint] = useState<boolean | null>(null);

  const perimeter = useMemo(() => derivePerimeter(plan.cells), [plan.cells]);
  const roomCount = useMemo(() => deriveRooms(plan).length, [plan]);

  const setCell = (k: CellKey, value: boolean) => {
    if (plan.cells.has(k) === value) return;
    const cells = new Set(plan.cells);
    if (value) cells.add(k);
    else cells.delete(k);
    onChange(normalizePlan({ ...plan, cells }));
  };

  const clickEdge = (e: EdgeKey) => {
    if (tool === "wall") {
      const walls = new Set(plan.walls);
      if (walls.has(e)) return;
      walls.add(e);
      onChange(normalizePlan({ ...plan, walls })); // 유효하지 않으면 normalize가 제거
    } else if (tool === "door") {
      if (!plan.walls.has(e) && !perimeter.has(e)) return; // 벽 위에만
      const doors = new Set(plan.doors);
      if (doors.has(e)) doors.delete(e);
      else doors.add(e);
      onChange({ ...plan, doors });
    } else if (tool === "erase") {
      const walls = new Set(plan.walls);
      const doors = new Set(plan.doors);
      walls.delete(e);
      doors.delete(e);
      onChange(normalizePlan({ ...plan, walls, doors }));
    }
  };

  const handleCellDown = (k: CellKey) => {
    if (tool === "floor") {
      const v = !plan.cells.has(k);
      setPaint(v);
      setCell(k, v);
    } else if (tool === "erase") {
      setPaint(false);
      setCell(k, false);
    }
  };

  const handleCellEnter = (k: CellKey, buttons: number) => {
    if (paint === null || buttons !== 1) return;
    setCell(k, paint);
  };

  // edge 렌더 좌표: H:x,z → (x..x+1, z) 수평선 / V:x,z → (x, z..z+1) 수직선
  const edgeLine = (e: EdgeKey) => {
    const { dir, x, z } = parseEdgeKey(e);
    return dir === "H"
      ? { x1: x * CELL_PX, y1: z * CELL_PX, x2: (x + 1) * CELL_PX, y2: z * CELL_PX }
      : { x1: x * CELL_PX, y1: z * CELL_PX, x2: x * CELL_PX, y2: (z + 1) * CELL_PX };
  };

  // 벽/문 도구일 때 클릭 가능한 edge 후보: 그리드 내 모든 내부 후보 + 외곽
  const edgeTargets = useMemo(() => {
    if (tool === "floor") return [];
    const targets: EdgeKey[] = [];
    for (let z = 0; z <= plan.rows; z++) {
      for (let x = 0; x < plan.cols; x++) targets.push(edgeKey("H", x, z));
    }
    for (let z = 0; z < plan.rows; z++) {
      for (let x = 0; x <= plan.cols; x++) targets.push(edgeKey("V", x, z));
    }
    return targets;
  }, [tool, plan.cols, plan.rows]);

  const cellRects = [];
  for (let z = 0; z < plan.rows; z++) {
    for (let x = 0; x < plan.cols; x++) {
      const k = cellKey(x, z);
      const selected = plan.cells.has(k);
      cellRects.push(
        <rect
          key={k}
          x={x * CELL_PX}
          y={z * CELL_PX}
          width={CELL_PX}
          height={CELL_PX}
          fill={selected ? "#e7d8b8" : "rgba(0,0,0,0.6)"}
          stroke="rgba(255,255,255,0.08)"
          onPointerDown={(ev) => {
            ev.preventDefault();
            handleCellDown(k);
          }}
          onPointerEnter={(ev) => handleCellEnter(k, ev.buttons)}
          className={tool === "floor" || tool === "erase" ? "cursor-crosshair" : ""}
        />,
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tool === t.id
                ? "bg-foreground text-background"
                : "bg-black/[.04] text-foreground/70 dark:bg-white/[.06]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-foreground/60">
          바닥 {plan.cells.size}칸 · 방 {roomCount}개 (1칸 = 0.5m)
        </span>
        <button
          onClick={onDone}
          disabled={plan.cells.size === 0}
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background disabled:opacity-40"
        >
          DONE → 3D 보기
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-black/10 dark:border-white/10">
        <svg
          width={plan.cols * CELL_PX}
          height={plan.rows * CELL_PX}
          onPointerUp={() => setPaint(null)}
          onPointerLeave={() => setPaint(null)}
          className="touch-none select-none"
        >
          {cellRects}

          {/* 파생 외곽 벽 */}
          {[...perimeter].map((e) => {
            const l = edgeLine(e);
            return (
              <line key={`p-${e}`} {...l} stroke="#374151" strokeWidth={5} strokeLinecap="square" pointerEvents="none" />
            );
          })}
          {/* 내부 벽 */}
          {[...plan.walls].map((e) => {
            const l = edgeLine(e);
            return (
              <line key={`w-${e}`} {...l} stroke="#111827" strokeWidth={5} strokeLinecap="square" pointerEvents="none" />
            );
          })}
          {/* 문 (벽 위에 갈색 표시) */}
          {[...plan.doors].map((e) => {
            const l = edgeLine(e);
            return (
              <line key={`d-${e}`} {...l} stroke="#b45309" strokeWidth={7} strokeLinecap="butt" pointerEvents="none" />
            );
          })}

          {/* 벽/문/지우개 도구용 edge 히트 영역 */}
          {edgeTargets.map((e) => {
            const l = edgeLine(e);
            const pad = 5;
            const isH = l.y1 === l.y2;
            return (
              <rect
                key={`t-${e}`}
                x={isH ? l.x1 : l.x1 - pad}
                y={isH ? l.y1 - pad : l.y1}
                width={isH ? CELL_PX : pad * 2}
                height={isH ? pad * 2 : CELL_PX}
                fill="transparent"
                className="cursor-pointer hover:fill-emerald-400/40"
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  clickEdge(e);
                }}
              />
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-foreground/50">
        바닥 도구로 칸을 칠하고, 벽 도구로 칸 사이 경계를 클릭해 방을 나누세요. 문 도구는 벽 위에만 놓을 수 있어요. 외곽 벽은 자동으로 생겨요.
      </p>
    </div>
  );
}
