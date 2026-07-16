"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import FurnitureCard from "@/components/FurnitureCard";
import type { FurnitureQuery, SearchResponse, SourceId } from "@/lib/types";

interface SourceInfo {
  id: SourceId;
  name: string;
  configured: boolean;
}

type SourceState =
  | { status: "loading" }
  | { status: "done"; data: SearchResponse };

type ResultsMap = Partial<Record<SourceId, SourceState>>;

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current ${className}`}
      aria-hidden
    />
  );
}

export default function Home() {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [results, setResults] = useState<ResultsMap>({});
  const [activeTab, setActiveTab] = useState<"all" | SourceId>("all");
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sources")
      .then((res) => res.json())
      .then((data: { sources: SourceInfo[] }) => {
        if (!cancelled) setSources(data.sources);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = (query: FurnitureQuery) => {
    setHasSearched(true);
    setActiveTab("all");
    setIsSearching(true);

    const initial: ResultsMap = {};
    for (const s of sources) {
      initial[s.id] = s.configured
        ? { status: "loading" }
        : {
            status: "done",
            data: {
              source: s.id,
              sourceName: s.name,
              status: "unconfigured",
              items: [],
              unverified: [],
            },
          };
    }
    setResults(initial);

    const tasks = sources
      .filter((s) => s.configured)
      .map(async (s) => {
        const params = new URLSearchParams();
        params.set("source", s.id);
        params.set("category", query.category);
        if (query.maxWidth) params.set("w", String(query.maxWidth));
        if (query.maxDepth) params.set("d", String(query.maxDepth));
        if (query.maxHeight) params.set("h", String(query.maxHeight));
        params.set("tol", String(query.tolerancePct));

        try {
          const res = await fetch(`/api/search?${params.toString()}`);
          const data: SearchResponse = await res.json();
          setResults((prev) => ({ ...prev, [s.id]: { status: "done", data } }));
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [s.id]: {
              status: "done",
              data: {
                source: s.id,
                sourceName: s.name,
                status: "error",
                items: [],
                unverified: [],
                error: err instanceof Error ? err.message : "요청에 실패했어요.",
              },
            },
          }));
        }
      });

    Promise.allSettled(tasks).then(() => setIsSearching(false));
  };

  const sourceNameOf = (id: SourceId) =>
    sources.find((s) => s.id === id)?.name ?? id;

  const { items, unverified } = useMemo(() => {
    const relevant: SearchResponse[] =
      activeTab === "all"
        ? sources
            .map((s) => results[s.id])
            .filter((r): r is SourceState & { status: "done" } => r?.status === "done")
            .map((r) => r.data)
        : (() => {
            const r = results[activeTab];
            return r?.status === "done" ? [r.data] : [];
          })();

    return {
      items: relevant.flatMap((r) => r.items),
      unverified: relevant.flatMap((r) => r.unverified),
    };
  }, [activeTab, results, sources]);

  const totalCount = useMemo(
    () =>
      sources.reduce((sum, s) => {
        const r = results[s.id];
        if (r?.status === "done" && r.data.status === "ok") {
          return sum + r.data.items.length;
        }
        return sum;
      }, 0),
    [sources, results],
  );

  const activeErrorData =
    activeTab !== "all" && results[activeTab]?.status === "done"
      ? (results[activeTab] as { status: "done"; data: SearchResponse }).data
      : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">가구 핏 파인더</h1>
          <p className="text-sm text-foreground/60">
            공간에 딱 맞는 가구를 치수로 찾아보세요.
          </p>
        </div>
        <Link
          href="/showroom"
          className="ml-auto rounded-full bg-black/[.04] px-3 py-1.5 text-sm text-foreground/70 dark:bg-white/[.06]"
        >
          3D 쇼룸 →
        </Link>
      </header>

      <SearchForm isSearching={isSearching} onSearch={handleSearch} />

      {!hasSearched && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/10 py-16 text-center text-foreground/50 dark:border-white/15">
          <p>가구 종류와 치수를 입력하고 검색해 보세요.</p>
          <p className="text-xs">
            여러 쇼핑몰에서 조건에 맞는 가구를 한 번에 모아볼 수 있어요.
          </p>
        </div>
      )}

      {hasSearched && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-black/10 pb-2 dark:border-white/10">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                activeTab === "all"
                  ? "bg-foreground text-background"
                  : "bg-black/[.04] text-foreground/70 dark:bg-white/[.06]"
              }`}
            >
              전체 ({totalCount})
            </button>
            {sources.map((s) => {
              const r = results[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                    activeTab === s.id
                      ? "bg-foreground text-background"
                      : "bg-black/[.04] text-foreground/70 dark:bg-white/[.06]"
                  }`}
                >
                  <span>{s.name}</span>
                  {!s.configured && (
                    <span className="rounded-full bg-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      미설정
                    </span>
                  )}
                  {r?.status === "loading" && <Spinner />}
                  {r?.status === "done" && r.data.status === "ok" && (
                    <span className="text-xs opacity-70">({r.data.items.length})</span>
                  )}
                  {r?.status === "done" && r.data.status === "error" && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      에러
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeErrorData?.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {activeErrorData.sourceName}: {activeErrorData.error ?? "검색 중 오류가 발생했어요."}
            </p>
          )}

          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-foreground/50">
              조건에 맞는 가구를 찾지 못했어요. 치수나 오차 범위를 조정해 보세요.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <FurnitureCard
                  key={`${item.source}-${item.id}`}
                  item={item}
                  sourceName={sourceNameOf(item.source)}
                />
              ))}
            </div>
          )}

          {unverified.length > 0 && (
            <details className="rounded-xl border border-black/10 p-4 dark:border-white/10">
              <summary className="cursor-pointer text-sm font-medium">
                치수 확인 필요 ({unverified.length})
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {unverified.map((item) => (
                  <FurnitureCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    sourceName={sourceNameOf(item.source)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </main>
  );
}
