import type { PointerEvent } from "react";
import { ASSET_PATHS } from "../game/assets";
import {
  LEVEL_LABELS,
  MEAT_LABELS,
  getCookLevel,
} from "../game/rules";
import type { GrillMeat, MeatKind } from "../game/types";

type PlateMeatProps = {
  kind: MeatKind;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
};

type GrillMeatProps = {
  meat: GrillMeat;
  isDragging?: boolean;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
};

type MeatVisualProps = {
  kind: MeatKind;
  level: 0 | 1 | 2 | 3;
  rotation?: number;
  scale?: number;
  draggable?: boolean;
  isHidden?: boolean;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function PlateMeat({ kind, onDragStart }: PlateMeatProps) {
  return (
    <MeatVisual
      kind={kind}
      level={0}
      draggable
      onPointerDown={onDragStart}
    />
  );
}

export function GrillMeatPiece({
  meat,
  isDragging = false,
  onDragStart,
}: GrillMeatProps) {
  const level = getCookLevel(meat.kind, meat.ageMs);

  return (
    <MeatVisual
      kind={meat.kind}
      level={level}
      rotation={meat.rotation}
      scale={meat.scale}
      draggable
      isHidden={isDragging}
      onPointerDown={onDragStart}
    />
  );
}

export function MeatVisual({
  kind,
  level,
  rotation = 0,
  scale = 1,
  draggable = false,
  isHidden = false,
  onPointerDown,
}: MeatVisualProps) {
  return (
    <button
      className={`meat meat-${kind} meat-level-${level}${isHidden ? " meat-hidden" : ""}`}
      style={{
        transform: `rotate(${rotation}deg) scale(${scale})`,
      }}
      type="button"
      aria-label={`${MEAT_LABELS[kind]} ${LEVEL_LABELS[level]}`}
      onPointerDown={onPointerDown}
      onTouchStart={(event) => {
        if (draggable) {
          event.preventDefault();
        }
      }}
      data-draggable={draggable ? "true" : "false"}
    >
      <img
        className="meatImage"
        src={ASSET_PATHS.meat(kind, level)}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {(level === 1 || level === 2) && <span className="sizzle" />}
    </button>
  );
}
