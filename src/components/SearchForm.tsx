"use client";

import { useState } from "react";
import type { FurnitureCategory, FurnitureQuery } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

type LengthUnit = "mm" | "cm";

interface SearchFormProps {
  isSearching: boolean;
  onSearch: (query: FurnitureQuery) => void;
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden
    />
  );
}

export default function SearchForm({ isSearching, onSearch }: SearchFormProps) {
  const [category, setCategory] = useState<FurnitureCategory>("desk");
  const [widthStr, setWidthStr] = useState("");
  const [depthStr, setDepthStr] = useState("");
  const [heightStr, setHeightStr] = useState("");
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [tolerancePct, setTolerancePct] = useState(0);

  const toMm = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.round(n * (unit === "mm" ? 1 : 10));
  };

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch({
      category,
      maxWidth: toMm(widthStr),
      maxDepth: toMm(depthStr),
      maxHeight: toMm(heightStr),
      tolerancePct,
    });
  };

  const dimInputClass =
    "w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl border border-black/10 bg-black/[.02] p-4 sm:p-6 dark:border-white/10 dark:bg-white/[.03]"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-sm font-medium">
            가구 종류
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as FurnitureCategory)}
            className={dimInputClass}
          >
            {(Object.keys(CATEGORY_LABELS) as FurnitureCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">최대 치수 (이 값 이하만 검색돼요)</span>
            <div className="flex overflow-hidden rounded-md border border-black/10 dark:border-white/15">
              {(["mm", "cm"] as LengthUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2 py-1 text-xs ${
                    unit === u
                      ? "bg-foreground text-background"
                      : "bg-transparent text-foreground/70"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="width" className="text-xs text-foreground/60">
                가로(W)
              </label>
              <input
                id="width"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="제한 없음"
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
                className={dimInputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="depth" className="text-xs text-foreground/60">
                깊이(D)
              </label>
              <input
                id="depth"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="제한 없음"
                value={depthStr}
                onChange={(e) => setDepthStr(e.target.value)}
                className={dimInputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="height" className="text-xs text-foreground/60">
                높이(H)
              </label>
              <input
                id="height"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="제한 없음"
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value)}
                className={dimInputClass}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tolerance" className="text-sm font-medium">
            허용 오차
          </label>
          <select
            id="tolerance"
            value={tolerancePct}
            onChange={(e) => setTolerancePct(Number(e.target.value))}
            className={dimInputClass}
          >
            <option value={0}>정확히 이하</option>
            <option value={5}>+5% 허용</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/60">
          입력한 치수는 공간에 들어가야 할 &quot;최대 허용 치수&quot;예요. 비워두면 해당 축은 제한하지 않아요.
        </p>
        <button
          type="submit"
          disabled={isSearching}
          className="flex shrink-0 items-center gap-2 rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching && <Spinner />}
          {isSearching ? "검색 중..." : "검색"}
        </button>
      </div>
    </form>
  );
}
