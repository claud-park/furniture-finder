"use client";

import { useEffect, useState } from "react";
import type { FurnitureCategory, FurnitureItem, SearchResponse, SourceId } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import type { PendingItem } from "@/lib/showroom/types";

interface SourceInfo {
  id: SourceId;
  name: string;
  configured: boolean;
}

interface Props {
  onSelect: (item: PendingItem) => void;
}

/** 파일 → ≤1024px JPEG data URL (localStorage 부담 완화) */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function DimsFields({
  dims,
  onChange,
}: {
  dims: { w: string; d: string; h: string };
  onChange: (dims: { w: string; d: string; h: string }) => void;
}) {
  const field = (key: "w" | "d" | "h", label: string) => (
    <label className="flex flex-col gap-1 text-xs text-foreground/60">
      {label}
      <input
        type="number"
        min={1}
        value={dims[key]}
        onChange={(e) => onChange({ ...dims, [key]: e.target.value })}
        className="w-20 rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm text-foreground dark:border-white/15"
      />
    </label>
  );
  return (
    <div className="flex gap-2">
      {field("w", "폭(mm)")}
      {field("d", "깊이(mm)")}
      {field("h", "높이(mm)")}
    </div>
  );
}

const parseDims = (d: { w: string; d: string; h: string }) => {
  const w = Number(d.w), dep = Number(d.d), h = Number(d.h);
  return w > 0 && dep > 0 && h > 0 ? { widthMm: w, depthMm: dep, heightMm: h } : null;
};

export default function FurniturePanel({ onSelect }: Props) {
  const [tab, setTab] = useState<"finder" | "upload">("finder");

  // ── Finder tab state ──
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [category, setCategory] = useState<FurnitureCategory>("desk");
  const [results, setResults] = useState<FurnitureItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  /** 치수 미비 아이템 선택 시 보정 입력 */
  const [fixing, setFixing] = useState<{ item: FurnitureItem; dims: { w: string; d: string; h: string } } | null>(null);

  // ── Upload tab state ──
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDims, setUploadDims] = useState({ w: "", d: "", h: "" });
  const [uploadMount, setUploadMount] = useState<"floor" | "wall">("floor");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d: { sources: SourceInfo[] }) => {
        if (!cancelled) setSources(d.sources);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const search = async () => {
    setSearching(true);
    setSearchError(null);
    setResults([]);
    setFixing(null);
    setHasSearched(true);
    const configured = sources.filter((s) => s.configured);
    if (configured.length === 0) {
      setSearchError("설정된 검색 소스가 없어요.");
      setSearching(false);
      return;
    }
    const failures: string[] = [];
    const all = await Promise.allSettled(
      configured.map(async (s) => {
        try {
          const res = await fetch(`/api/search?source=${s.id}&category=${category}&tol=0`);
          const data: SearchResponse = await res.json();
          if (data.status === "error") {
            failures.push(`${s.name}: ${data.error ?? "검색 중 오류가 발생했어요"}`);
            return [];
          }
          return [...data.items, ...data.unverified];
        } catch {
          failures.push(`${s.name}: 검색 중 오류가 발생했어요`);
          return [];
        }
      }),
    );
    setResults(all.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
    if (failures.length > 0) setSearchError(failures.join(", "));
    setSearching(false);
  };

  const pickFinderItem = (item: FurnitureItem) => {
    const d = item.dimensions;
    if (d?.width && d?.depth && d?.height) {
      onSelect({
        source: "finder",
        title: item.title,
        widthMm: d.width,
        depthMm: d.depth,
        heightMm: d.height,
        imageUrl: item.imageUrl ?? "",
        mount: "floor",
      });
    } else {
      setFixing({
        item,
        dims: {
          w: d?.width ? String(d.width) : "",
          d: d?.depth ? String(d.depth) : "",
          h: d?.height ? String(d.height) : "",
        },
      });
    }
  };

  const tabBtn = (id: "finder" | "upload", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-full px-3 py-1.5 text-sm ${
        tab === id
          ? "bg-foreground text-background"
          : "bg-black/[.04] text-foreground/70 dark:bg-white/[.06]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <aside className="flex w-full flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10 lg:w-80">
      <div className="flex gap-2">
        {tabBtn("finder", "가구 검색")}
        {tabBtn("upload", "사진 가져오기")}
      </div>

      {tab === "finder" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FurnitureCategory)}
              className="flex-1 rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            >
              {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={search}
              disabled={searching}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
            >
              {searching ? "검색 중…" : "검색"}
            </button>
          </div>

          {searchError && <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>}

          {fixing && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-xs text-foreground/70">
                이 상품은 치수 정보가 부족해요. 직접 입력해 주세요.
              </p>
              <p className="line-clamp-1 text-sm font-medium">{fixing.item.title}</p>
              <DimsFields dims={fixing.dims} onChange={(dims) => setFixing({ ...fixing, dims })} />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const d = parseDims(fixing.dims);
                    if (!d) return;
                    onSelect({
                      source: "finder",
                      title: fixing.item.title,
                      ...d,
                      imageUrl: fixing.item.imageUrl ?? "",
                      mount: "floor",
                    });
                    setFixing(null);
                  }}
                  disabled={!parseDims(fixing.dims)}
                  className="rounded-md bg-foreground px-3 py-1 text-sm text-background disabled:opacity-40"
                >
                  배치하기
                </button>
                <button onClick={() => setFixing(null)} className="text-sm text-foreground/60">
                  취소
                </button>
              </div>
            </div>
          )}

          <ul className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
            {results.map((item) => (
              <li key={`${item.source}-${item.id}`}>
                <button
                  onClick={() => pickFinderItem(item)}
                  className="flex w-full items-center gap-2 rounded-lg border border-black/10 p-2 text-left hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded bg-black/[.05] text-xs dark:bg-white/[.08]">?</span>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="line-clamp-2 text-xs">{item.title}</span>
                    <span className="text-[11px] text-foreground/50">
                      {item.dimensions?.width && item.dimensions?.depth && item.dimensions?.height
                        ? `${item.dimensions.width}×${item.dimensions.depth}×${item.dimensions.height}mm`
                        : "치수 입력 필요"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!searching && results.length === 0 && (
              <li className="py-6 text-center text-xs text-foreground/50">
                {hasSearched
                  ? "조건에 맞는 가구를 찾지 못했어요."
                  : "카테고리를 고르고 검색해 보세요."}
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "upload" && (
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPhoto(await fileToDataUrl(f));
                if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, ""));
              }
            }}
            className="text-sm"
          />
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="업로드 미리보기" className="max-h-40 rounded-lg object-contain" />
          )}
          <input
            type="text"
            placeholder="이름 (예: 원목 책상)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
          />
          <DimsFields dims={uploadDims} onChange={setUploadDims} />
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={uploadMount === "wall"}
              onChange={(e) => setUploadMount(e.target.checked ? "wall" : "floor")}
            />
            벽걸이 (선반·액자 등)
          </label>
          <button
            onClick={() => {
              const d = parseDims(uploadDims);
              if (!photo || !d) return;
              onSelect({
                source: "upload",
                title: uploadTitle || "가져온 가구",
                ...d,
                imageUrl: photo,
                mount: uploadMount,
              });
            }}
            disabled={!photo || !parseDims(uploadDims)}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
          >
            배치하기
          </button>
          <p className="text-xs text-foreground/50">
            사진만으로는 크기를 알 수 없어요. 실제 치수(mm)를 입력해야 배치할 수 있어요.
          </p>
        </div>
      )}
    </aside>
  );
}
