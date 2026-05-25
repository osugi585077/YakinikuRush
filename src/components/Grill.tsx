import { useEffect, useState } from "react";
import type { PointerEvent, RefObject } from "react";
import { ASSET_PATHS } from "../game/assets";
import { SLOT_COUNT } from "../game/rules";
import type { GrillMeat } from "../game/types";
import { GrillMeatPiece } from "./MeatPiece";

type GrillProps = {
  meats: GrillMeat[];
  grillRef: RefObject<HTMLDivElement | null>;
  draggingMeatId: number | null;
  onMeatDragStart: (id: number, event: PointerEvent<HTMLElement>) => void;
};

const GRILL_FRAME_MS = 120;

export function Grill({
  meats,
  grillRef,
  draggingMeatId,
  onMeatDragStart,
}: GrillProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const slots = Array.from({ length: SLOT_COUNT }, (_, slot) => ({
    slot,
    meat: meats.find((item) => item.slot === slot),
  }));

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % ASSET_PATHS.grillFrames.length);
    }, GRILL_FRAME_MS);

    return () => window.clearInterval(timerId);
  }, []);

  return (
    <section className="grillStage" aria-label="焼き網">
      <div className="smokeLayer" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="grill" ref={grillRef}>
        <img
          className="grillImageFrame"
          src={ASSET_PATHS.grillFrames[frameIndex]}
          alt=""
          aria-hidden="true"
        />
        <div className="slotGrid">
          {slots.map(({ slot, meat }) => (
            <div className="grillSlot" key={slot}>
              {meat && (
                <GrillMeatPiece
                  meat={meat}
                  isDragging={draggingMeatId === meat.id}
                  onDragStart={(event) => onMeatDragStart(meat.id, event)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
