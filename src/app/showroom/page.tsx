"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import FloorPlanEditor from "@/components/showroom/FloorPlanEditor";
import type { FloorPlan, PlacedItem } from "@/lib/showroom/types";
import {
  STORAGE_KEY,
  emptyPlan,
  serializeShowroom,
  deserializeShowroom,
} from "@/lib/showroom/storage";

export default function ShowroomPage() {
  const [mode, setMode] = useState<"edit" | "furnish">("edit");
  const [plan, setPlan] = useState<FloorPlan>(emptyPlan);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const loaded = useRef(false);

  // 최초 로드: localStorage 복원
  useEffect(() => {
    const saved = deserializeShowroom(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 후 localStorage 복원(hydration mismatch 방지 목적)
      setPlan(saved.plan);
      setItems(saved.items);
    }
    loaded.current = true;
  }, []);

  // 변경 시 저장 (복원 전에는 저장 금지)
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeShowroom({ plan, items }));
    } catch {
      // 용량 초과 등 — 저장 실패는 치명적이지 않음
    }
  }, [plan, items]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">3D 가구 쇼룸</h1>
          <p className="text-sm text-foreground/60">
            격자를 클릭해 집을 그리고, 3D로 가구를 배치해 보세요.
          </p>
        </div>
        <Link href="/" className="ml-auto text-sm text-foreground/60 underline underline-offset-4">
          ← 가구 검색으로
        </Link>
      </header>

      {mode === "edit" ? (
        <FloorPlanEditor plan={plan} onChange={setPlan} onDone={() => setMode("furnish")} />
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <button
              onClick={() => setMode("edit")}
              className="rounded-full bg-black/[.04] px-3 py-1.5 text-sm text-foreground/70 dark:bg-white/[.06]"
            >
              ← 평면도 수정
            </button>
          </div>
          {/* Task 9에서 ShowroomScene으로 교체 */}
          <p className="py-16 text-center text-sm text-foreground/50">3D 뷰 준비 중…</p>
        </div>
      )}
    </main>
  );
}
