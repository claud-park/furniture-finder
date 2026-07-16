const MM = 1 / 1000;

/** 바닥 배치: 박스 중심 y = 높이/2 */
export function floorPosition(
  hit: [number, number, number],
  dims: { heightMm: number },
): [number, number, number] {
  return [hit[0], (dims.heightMm * MM) / 2, hit[2]];
}

/**
 * 벽 배치: 히트 지점을 벽의 수평 노멀 방향으로 깊이/2만큼 밀어
 * 아이템 뒷면이 벽에 붙게 한다. 아이템 정면(+z 로컬)이 노멀 방향을 향함.
 */
export function wallPlacement(
  hit: [number, number, number],
  normal: [number, number, number],
  dims: { depthMm: number },
): { position: [number, number, number]; rotationY: number } {
  const off = (dims.depthMm * MM) / 2;
  return {
    position: [hit[0] + normal[0] * off, hit[1], hit[2] + normal[2] * off],
    rotationY: Math.atan2(normal[0], normal[2]),
  };
}

/** GLB 바운딩박스 → 실제 치수(mm)에 맞는 축별 스케일. x=폭, y=높이, z=깊이 */
export function fitScale(
  bboxSize: [number, number, number],
  dims: { widthMm: number; depthMm: number; heightMm: number },
): [number, number, number] {
  const target = [dims.widthMm * MM, dims.heightMm * MM, dims.depthMm * MM];
  return [0, 1, 2].map((i) =>
    bboxSize[i] > 0 ? target[i] / bboxSize[i] : 1,
  ) as [number, number, number];
}
