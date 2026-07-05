import type { SourceAdapter, SourceId } from "../types";
import { ikeaAdapter } from "./ikea";
import { coupangAdapter } from "./coupang";
import { createPseAdapter } from "./pse";

/**
 * 새 소스 추가 방법:
 * 1. src/lib/adapters/<source>.ts 에 SourceAdapter 구현체 작성
 * 2. src/lib/types.ts 의 SourceId 유니온에 id 추가
 * 3. 아래 배열에 등록 — UI/라우트는 자동 반영
 */
export const adapters: SourceAdapter[] = [
  ikeaAdapter,
  coupangAdapter,
  createPseAdapter({ id: "ohou", name: "오늘의집", site: "ohou.se" }),
  createPseAdapter({ id: "muji", name: "무인양품", site: "muji.com" }),
];

export function getAdapter(id: string): SourceAdapter | undefined {
  return adapters.find((a) => a.id === (id as SourceId));
}
