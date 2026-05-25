import type { CookLevel, MeatKind, PlateMeat } from "./types";

export const GAME_DURATION_MS = 60_000;
export const COUNTDOWN_DURATION_MS = 3_000;
export const ENDING_MESSAGE_MS = 1_600;
export const SLOT_COUNT = 9;
export const MAX_MEAT_ON_GRILL = 9;

export const PLATE_MEATS: PlateMeat[] = [
  { plateId: 1, kind: "tan" },
  { plateId: 2, kind: "karubi" },
  { plateId: 3, kind: "harami" },
  { plateId: 4, kind: "horumon" },
];

export const MEAT_LABELS: Record<MeatKind, string> = {
  tan: "\u30bf\u30f3",
  karubi: "\u30ab\u30eb\u30d3",
  harami: "\u30cf\u30e9\u30df",
  horumon: "\u30db\u30eb\u30e2\u30f3",
};

export const LEVEL_LABELS: Record<CookLevel, string> = {
  0: "\u751f",
  1: "\u751f\u713c\u3051",
  2: "\u6700\u9ad8",
  3: "\u7126\u3052",
};

const LEVEL_THRESHOLDS: Record<MeatKind, [number, number, number]> = {
  tan: [1_500, 3_000, 5_000],
  karubi: [3_000, 6_000, 9_000],
  harami: [5_000, 8_000, 12_000],
  horumon: [7_000, 12_000, 17_000],
};

const SCORE_BY_KIND_AND_LEVEL: Record<MeatKind, Record<CookLevel, number>> = {
  tan: { 0: 0, 1: 5, 2: 50, 3: -50 },
  karubi: { 0: 0, 1: 10, 2: 100, 3: -50 },
  harami: { 0: 0, 1: 20, 2: 300, 3: -50 },
  horumon: { 0: 0, 1: 30, 2: 500, 3: -50 },
};

export function getCookLevel(kind: MeatKind, ageMs: number): CookLevel {
  const [level1, level2, level3] = LEVEL_THRESHOLDS[kind];
  if (ageMs < level1) return 0;
  if (ageMs < level2) return 1;
  if (ageMs < level3) return 2;
  return 3;
}

export function getScore(kind: MeatKind, level: CookLevel): number {
  return SCORE_BY_KIND_AND_LEVEL[kind][level];
}

export function getMultiplier(combo: number): number {
  if (combo <= 0) return 1;
  return Math.min(3, 1 + Math.floor(combo / 3) * 0.25);
}

export function isComboLevel(level: CookLevel): boolean {
  return level === 1 || level === 2;
}

export function formatTime(ms: number): string {
  return Math.max(0, Math.ceil(ms / 1000)).toString();
}
