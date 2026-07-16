import type { CellKey, EdgeKey, FloorPlan, PlacedItem } from "./types";
import { normalizePlan } from "./perimeter";

export const STORAGE_KEY = "furniture-finder:showroom:v1";

export interface ShowroomState {
  plan: FloorPlan;
  items: PlacedItem[];
}

interface Envelope {
  v: 1;
  plan: { cols: number; rows: number; cells: CellKey[]; walls: EdgeKey[]; doors: EdgeKey[] };
  items: PlacedItem[];
}

export function emptyPlan(): FloorPlan {
  return { cols: 24, rows: 16, cells: new Set(), walls: new Set(), doors: new Set() };
}

export function serializeShowroom(state: ShowroomState): string {
  const env: Envelope = {
    v: 1,
    plan: {
      cols: state.plan.cols,
      rows: state.plan.rows,
      cells: [...state.plan.cells],
      walls: [...state.plan.walls],
      doors: [...state.plan.doors],
    },
    items: state.items,
  };
  return JSON.stringify(env);
}

export function deserializeShowroom(raw: string | null): ShowroomState | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    if (env?.v !== 1 || !env.plan || !Array.isArray(env.items)) return null;
    if (
      typeof env.plan.cols !== "number" ||
      typeof env.plan.rows !== "number" ||
      !Array.isArray(env.plan.cells) ||
      !Array.isArray(env.plan.walls) ||
      !Array.isArray(env.plan.doors)
    ) {
      return null;
    }
    const plan: FloorPlan = {
      cols: env.plan.cols,
      rows: env.plan.rows,
      cells: new Set(env.plan.cells),
      walls: new Set(env.plan.walls),
      doors: new Set(env.plan.doors),
    };
    return { plan: normalizePlan(plan), items: env.items };
  } catch {
    return null;
  }
}
