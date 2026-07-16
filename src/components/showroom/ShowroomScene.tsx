"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { FloorPlan, PendingItem, PlacedItem } from "@/lib/showroom/types";
import { CELL_SIZE_M } from "@/lib/showroom/types";
import { buildHouseGeometry } from "@/lib/showroom/geometry";
import { floorPosition, wallPlacement } from "@/lib/showroom/placement";

/** 외부 URL을 동일 출처 프록시로 감싼다 (data URL은 그대로) */
export function proxied(url: string): string {
  return url.startsWith("data:") ? url : `/api/proxy?url=${encodeURIComponent(url)}`;
}

export interface ShowroomSceneProps {
  plan: FloorPlan;
  items: PlacedItem[];
  pending: PendingItem | null;
  onPlace: (item: PlacedItem) => void;
  onCancelPending: () => void;
  onUpdate: (item: PlacedItem) => void;
  onRemove: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

type Pose = { position: [number, number, number]; rotationY: number };

/**
 * PendingItem/PlacedItem 판별. `"rotationY" in active` 인라인 체크는 클로저로
 * 캡처된 변수에서 TS 내로잉이 깨지는 경우가 있어 명시적 타입 가드로 대체.
 */
function isPlaced(item: PendingItem | PlacedItem): item is PlacedItem {
  return "rotationY" in item;
}

/** 사진 텍스처 박스. 텍스처 로드 실패 시 단색 박스로 폴백. */
function ItemBox({
  item,
  ghost = false,
  selected = false,
  onSelectClick,
}: {
  item: Pick<PlacedItem, "widthMm" | "depthMm" | "heightMm" | "imageUrl"> & Partial<Pose>;
  ghost?: boolean;
  selected?: boolean;
  onSelectClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!item.imageUrl) return;
    let disposed = false;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(
      proxied(item.imageUrl),
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        if (!disposed) {
          loaded = t;
          setTexture(t);
        } else t.dispose();
      },
      undefined,
      () => {}, // 실패 → 단색 유지
    );
    return () => {
      disposed = true;
      loaded?.dispose();
    };
  }, [item.imageUrl]);

  const size: [number, number, number] = [
    item.widthMm / 1000,
    item.heightMm / 1000,
    item.depthMm / 1000,
  ];

  return (
    <mesh
      position={item.position ?? [0, 0, 0]}
      rotation={[0, item.rotationY ?? 0, 0]}
      onClick={onSelectClick}
      castShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? "#ffffff" : "#8b9dc3"}
        transparent={ghost}
        opacity={ghost ? 0.5 : 1}
        emissive={selected ? "#2563eb" : "#000000"}
        emissiveIntensity={selected ? 0.25 : 0}
      />
    </mesh>
  );
}

export default function ShowroomScene({
  plan,
  items,
  pending,
  onPlace,
  onCancelPending,
  onUpdate,
  onRemove,
  selectedId,
  onSelect,
}: ShowroomSceneProps) {
  const geo = useMemo(() => buildHouseGeometry(plan), [plan]);
  const target: [number, number, number] = [geo.bounds.centerX, 0, geo.bounds.centerZ];

  const [ghost, setGhost] = useState<Pose | null>(null);
  /** 배치된 아이템 드래그 이동 중이면 해당 아이템 */
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const dragging = items.find((i) => i.id === draggingId) ?? null;
  /** 지금 커서를 따라다녀야 하는 대상 (신규 배치 or 이동) */
  const active: (PendingItem | PlacedItem) | null = pending ?? dragging;

  // eslint-disable-next-line react-hooks/set-state-in-effect -- pending 전환 시 이전 고스트 프리뷰를 즉시 지움
  useEffect(() => setGhost(null), [pending]);

  // Delete/R 키 처리
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) onRemove(selected.id);
      if ((e.key === "r" || e.key === "R") && selected) {
        onUpdate({ ...selected, rotationY: selected.rotationY + Math.PI / 12 });
      }
      if (e.key === "Escape") {
        onCancelPending();
        setDraggingId(null);
        onSelect(null);
        setGhost(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onRemove, onUpdate, onCancelPending, onSelect]);

  const poseFromHit = (e: ThreeEvent<PointerEvent>, kind: "floor" | "wall"): Pose | null => {
    if (!active) return null;
    const p: [number, number, number] = [e.point.x, e.point.y, e.point.z];
    if (kind === "floor") {
      if (active.mount !== "floor") return null;
      return { position: floorPosition(p, active), rotationY: isPlaced(active) ? active.rotationY : 0 };
    }
    if (active.mount !== "wall" || !e.face) return null;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
    if (Math.abs(n.y) > 0.5) return null; // 벽의 윗면/아랫면 제외
    return wallPlacement(p, [n.x, n.y, n.z], active);
  };

  const handleMove = (kind: "floor" | "wall") => (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
    e.stopPropagation();
    setGhost(poseFromHit(e, kind));
  };

  /** 커서가 바닥/벽을 벗어나면 고스트를 지운다 (빈 공간 위에서는 프리뷰가 남지 않도록) */
  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
    e.stopPropagation();
    setGhost(null);
  };

  const handleClick = (kind: "floor" | "wall") => (e: ThreeEvent<PointerEvent>) => {
    if (!active) {
      onSelect(null); // 빈 바닥/벽 클릭 → 선택 해제
      return;
    }
    e.stopPropagation();
    const pose = poseFromHit(e, kind);
    if (!pose) return;
    if (pending) {
      onPlace({ ...pending, id: crypto.randomUUID(), ...pose });
      onCancelPending();
    } else if (dragging) {
      onUpdate({ ...dragging, ...pose });
      setDraggingId(null);
    }
    setGhost(null);
  };

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-xl border border-black/10 bg-neutral-900 dark:border-white/10">
      <Canvas shadows camera={{ position: [target[0] + 8, 8, target[2] + 8], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 5]} intensity={1.2} castShadow />

        {/* 바닥 타일 — floor 레이캐스트 대상 */}
        {geo.floors.map((f) => (
          <mesh
            key={f.cell}
            position={[f.center[0], -0.025, f.center[2]]}
            receiveShadow
            onPointerMove={handleMove("floor")}
            onPointerOut={handleOut}
            onClick={handleClick("floor")}
          >
            <boxGeometry args={[CELL_SIZE_M, 0.05, CELL_SIZE_M]} />
            <meshStandardMaterial color="#d9c8a4" />
          </mesh>
        ))}

        {/* 벽 — wall 레이캐스트 대상 (상인방 제외) */}
        {geo.walls.map((w) => (
          <mesh
            key={`${w.edge}-${w.kind}`}
            position={w.center}
            castShadow
            receiveShadow
            onPointerMove={w.kind === "wall" ? handleMove("wall") : undefined}
            onPointerOut={w.kind === "wall" ? handleOut : undefined}
            onClick={w.kind === "wall" ? handleClick("wall") : undefined}
          >
            <boxGeometry args={w.size} />
            <meshStandardMaterial color={w.kind === "lintel" ? "#e5e7eb" : "#f3f4f6"} />
          </mesh>
        ))}

        {/* 배치된 아이템 */}
        {items.map((item) =>
          item.id === draggingId ? null : (
            <ItemBox
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelectClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
              }}
            />
          ),
        )}

        {/* 고스트 프리뷰 */}
        {active && ghost && <ItemBox item={{ ...active, ...ghost }} ghost />}

        {/* 대지 — 레이캐스트 핸들러 없음 (빈 공간 배치 불가) */}
        <mesh position={[target[0], -0.06, target[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>

        <OrbitControls target={target} makeDefault enabled={!active} />
      </Canvas>

      {/* 상태 오버레이 */}
      {active && (
        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">
          {pending ? `"${pending.title}" 배치 중` : "이동 중"} — 바닥/벽을 클릭하세요 (Esc 취소)
        </p>
      )}
      {selected && !active && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">
          <span className="max-w-40 truncate">{selected.title}</span>
          <button onClick={() => setDraggingId(selected.id)} className="underline">이동</button>
          <button
            onClick={() => onUpdate({ ...selected, rotationY: selected.rotationY + Math.PI / 12 })}
            className="underline"
          >
            회전(R)
          </button>
          <button onClick={() => onRemove(selected.id)} className="underline">삭제(Del)</button>
        </div>
      )}
    </div>
  );
}
