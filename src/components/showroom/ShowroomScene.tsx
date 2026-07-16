"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { FloorPlan, PlacedItem } from "@/lib/showroom/types";
import { CELL_SIZE_M } from "@/lib/showroom/types";
import { buildHouseGeometry } from "@/lib/showroom/geometry";

/** 외부 URL을 동일 출처 프록시로 감싼다 (data URL은 그대로) */
export function proxied(url: string): string {
  return url.startsWith("data:") ? url : `/api/proxy?url=${encodeURIComponent(url)}`;
}

export interface ShowroomSceneProps {
  plan: FloorPlan;
  items: PlacedItem[];
}

function House({ plan }: { plan: FloorPlan }) {
  const geo = useMemo(() => buildHouseGeometry(plan), [plan]);
  return (
    <group>
      {geo.floors.map((f) => (
        <mesh key={f.cell} position={[f.center[0], -0.025, f.center[2]]} receiveShadow>
          <boxGeometry args={[CELL_SIZE_M, 0.05, CELL_SIZE_M]} />
          <meshStandardMaterial color="#d9c8a4" />
        </mesh>
      ))}
      {geo.walls.map((w) => (
        <mesh key={`${w.edge}-${w.kind}`} position={w.center} castShadow receiveShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color={w.kind === "lintel" ? "#e5e7eb" : "#f3f4f6"} />
        </mesh>
      ))}
    </group>
  );
}

export default function ShowroomScene({ plan }: ShowroomSceneProps) {
  const geo = useMemo(() => buildHouseGeometry(plan), [plan]);
  const target: [number, number, number] = [geo.bounds.centerX, 0, geo.bounds.centerZ];

  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-black/10 bg-neutral-900 dark:border-white/10">
      <Canvas shadows camera={{ position: [target[0] + 8, 8, target[2] + 8], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 5]} intensity={1.2} castShadow />
        <House plan={plan} />
        {/* 대지(참고용 지면) — 레이캐스트 대상 아님 */}
        <mesh position={[target[0], -0.06, target[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <OrbitControls target={target} makeDefault />
      </Canvas>
    </div>
  );
}
