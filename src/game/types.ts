export type MeatKind = "tan" | "karubi" | "harami" | "horumon" | "steak";

export type CookLevel = 0 | 1 | 2 | 3;

export type GamePhase =
  | "ready"
  | "countdown"
  | "playing"
  | "paused"
  | "ending"
  | "finished";

export type PlateMeat = {
  plateId: number;
  kind: MeatKind;
};

export type GrillMeat = {
  id: number;
  kind: MeatKind;
  slot: number;
  ageMs: number;
  rotation: number;
  scale: number;
};

export type DragSource =
  | { type: "plate"; plateId: number; kind: MeatKind }
  | { type: "grill"; id: number };

export type DragState = {
  source: DragSource;
  x: number;
  y: number;
};

export type ScoreEvent = {
  label: string;
  points: number;
  multiplier: number;
};
