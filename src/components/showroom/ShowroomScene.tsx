"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { FloorPlan, PendingItem, PlacedItem } from "@/lib/showroom/types";
import { CELL_SIZE_M } from "@/lib/showroom/types";
import { buildHouseGeometry } from "@/lib/showroom/geometry";
import { floorPosition, wallPlacement, fitScale } from "@/lib/showroom/placement";

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

  const commonMaterialProps = {
    transparent: ghost,
    opacity: ghost ? 0.5 : 1,
    emissive: selected ? "#2563eb" : "#000000",
    emissiveIntensity: selected ? 0.25 : 0,
  } as const;

  return (
    <mesh
      position={item.position ?? [0, 0, 0]}
      rotation={[0, item.rotationY ?? 0, 0]}
      onClick={onSelectClick}
      castShadow
    >
      <boxGeometry args={size} />
      {/*
        상품 사진은 정면/후면(±z, BoxGeometry 면 순서상 material-4/5)에만 입힌다.
        재질을 하나만 넘기면 위/아래/옆면에도 같은 텍스처가 씌워지는데, 그 면들의 기본 UV는
        "눕혀서" 매핑돼 카메라가 내려다보는 기본 시점에서 가구가 옆으로 누운 것처럼 보였다.
      */}
      {[0, 1, 2, 3].map((i) => (
        <meshStandardMaterial key={i} attach={`material-${i}`} color="#8b9dc3" {...commonMaterialProps} />
      ))}
      {[4, 5].map((i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          map={texture ?? undefined}
          color={texture ? "#ffffff" : "#8b9dc3"}
          {...commonMaterialProps}
        />
      ))}
    </mesh>
  );
}

/** GLB 아이템: 바운딩박스를 실제 치수로 스케일. 로드 실패는 ErrorBoundary 대신 상위 Suspense+fallback 처리 */
function ItemMesh({
  item,
  selected,
  onSelectClick,
}: {
  item: PlacedItem;
  selected: boolean;
  onSelectClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { scene } = useGLTF(proxied(item.meshUrl!));
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { scale, center } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const c = new THREE.Vector3();
    box.getCenter(c);
    return { scale: fitScale([size.x, size.y, size.z], item), center: c };
  }, [cloned, item]);

  return (
    <group position={item.position} rotation={[0, item.rotationY, 0]} onClick={onSelectClick}>
      {/* GLB 원점이 제각각이라 바운딩박스 중심을 아이템 원점에 맞추고(re-center), 스케일은 실제 치수(mm)에 맞춘다 */}
      <group scale={scale}>
        <primitive
          object={cloned}
          position={[-center.x, -center.y, -center.z]}
        />
      </group>
      {selected && (
        <mesh>
          <boxGeometry args={[item.widthMm / 1000, item.heightMm / 1000, item.depthMm / 1000]} />
          <meshBasicMaterial color="#2563eb" wireframe />
        </mesh>
      )}
    </group>
  );
}

/** GLB 로드 실패(만료된 URL 등) 시 텍스처 박스로 영구 폴백. meshUrl이 바뀌면 재시도. */
class MeshErrorBoundary extends Component<
  { fallback: ReactNode; resetKey: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false }); // 새 meshUrl이면 재시도
    }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** 배치 아이템 렌더 선택: meshUrl 있으면 GLTF(Suspense+ErrorBoundary), 없으면 텍스처 박스 */
function PlacedItemView(props: {
  item: PlacedItem;
  selected: boolean;
  onSelectClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  if (!props.item.meshUrl) return <ItemBox {...props} item={props.item} />;
  return (
    <MeshErrorBoundary resetKey={props.item.meshUrl} fallback={<ItemBox {...props} item={props.item} />}>
      <Suspense fallback={<ItemBox {...props} item={props.item} />}>
        <ItemMesh {...props} />
      </Suspense>
    </MeshErrorBoundary>
  );
}

async function toDataUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith("data:")) return imageUrl;
  const blob = await (await fetch(proxied(imageUrl))).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * 사진 → 3D 생성 폴링 훅.
 * - `itemsRef`: 항상 최신 배치 아이템 목록을 가리키는 ref. 폴링 도중 아이템이 삭제되면
 *   체인을 조용히 중단해 삭제된 id로 onUpdate가 호출되는 것(부활 위험)을 막는다.
 *   같은 ref로 `getItem`을 노출해, 성공 시점에도 폴링 시작 시점이 아닌 현재 item(이동/회전 반영)에
 *   meshUrl을 덮어써 stale writeback을 막는다.
 * - 한 번에 하나의 업그레이드만 진행: 새 `start` 호출 시 진행 중이던 체인은 취소한다.
 */
function useMeshUpgrade(onUpdate: (item: PlacedItem) => void, itemsRef: RefObject<PlacedItem[]>) {
  const [state, setState] = useState<{ itemId: string; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState(null);
  }, []);

  const getItem = useCallback(
    (id: string) => itemsRef.current.find((i) => i.id === id),
    [itemsRef],
  );
  const exists = useCallback((id: string) => getItem(id) !== undefined, [getItem]);

  const start = useCallback(
    async (item: PlacedItem) => {
      cancel(); // 동시 업그레이드 방지: 진행 중인 체인이 있으면 취소 후 새로 시작
      setState({ itemId: item.id, message: "3D 모델 생성 요청 중…" });
      try {
        const res = await fetch("/api/model3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: await toDataUrl(item.imageUrl) }),
        });
        const data = (await res.json()) as { taskId?: string; error?: string };
        if (!res.ok || !data.taskId) throw new Error(data.error ?? "요청 실패");

        const startedAt = Date.now();
        const poll = async () => {
          if (!exists(item.id)) {
            setState(null); // 폴링 중 아이템 삭제됨 → 조용히 중단
            return;
          }
          if (Date.now() - startedAt > 5 * 60 * 1000) throw new Error("시간 초과");
          const r = await fetch(`/api/model3d?taskId=${encodeURIComponent(data.taskId!)}`);
          const task = (await r.json()) as { status: string; modelUrl?: string; error?: string };
          if (!exists(item.id)) {
            setState(null); // 응답 대기 중 삭제됨 → onUpdate로 부활시키지 않음
            return;
          }
          if (task.status === "succeeded" && task.modelUrl) {
            // 폴링 도중 이동/회전됐을 수 있으니 시작 시점 item이 아닌 현재 item에 덮어쓴다
            const current = getItem(item.id);
            if (current) onUpdate({ ...current, meshUrl: task.modelUrl });
            setState(null);
          } else if (task.status === "failed") {
            throw new Error(task.error ?? "생성 실패");
          } else {
            setState({ itemId: item.id, message: "3D 모델 생성 중… (최대 몇 분 걸려요)" });
            timer.current = setTimeout(() => poll().catch(fail), 5000);
          }
        };
        const fail = (err: unknown) => {
          setState({
            itemId: item.id,
            message: `실패: ${err instanceof Error ? err.message : "알 수 없는 오류"} — 박스로 유지해요`,
          });
          timer.current = setTimeout(() => setState(null), 4000);
        };
        poll().catch(fail);
      } catch (err) {
        setState({
          itemId: item.id,
          message: `실패: ${err instanceof Error ? err.message : "알 수 없는 오류"} — 박스로 유지해요`,
        });
        timer.current = setTimeout(() => setState(null), 4000);
      }
    },
    [onUpdate, cancel, exists, getItem],
  );

  useEffect(() => () => cancel(), [cancel]);
  return { state, start };
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
  /** 항상 최신 items를 가리키는 ref — 폴링 체인이 삭제된 아이템을 참조하지 않도록 함 */
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const { state: upgradeState, start: startUpgrade } = useMeshUpgrade(onUpdate, itemsRef);

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
            <PlacedItemView
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelectClick={(e) => {
                // 배치/이동 중에는 전파를 막지 않아 클릭이 뒤쪽 바닥/벽까지 도달하게 한다
                if (active) return;
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
          {!selected.meshUrl && !upgradeState && (
            <button onClick={() => startUpgrade(selected)} className="underline">
              3D 모델 생성
            </button>
          )}
        </div>
      )}
      {upgradeState && (
        <p className="absolute bottom-3 left-3 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">
          {upgradeState.message}
        </p>
      )}
    </div>
  );
}
