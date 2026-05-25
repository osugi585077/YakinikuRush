import type { PointerEvent } from "react";
import { MEAT_LABELS } from "../game/rules";
import type { PlateMeat as PlateMeatType } from "../game/types";
import { PlateMeat } from "./MeatPiece";

type MeatPlatesProps = {
  plates: PlateMeatType[];
  onPlateDragStart: (
    plate: PlateMeatType,
    event: PointerEvent<HTMLElement>,
  ) => void;
};

export function MeatPlates({ plates, onPlateDragStart }: MeatPlatesProps) {
  return (
    <section className="plateRail" aria-label="生肉の皿">
      {plates.map((plate) => (
        <div className="meatPlate" key={plate.plateId}>
          <span className="plateLabel">{MEAT_LABELS[plate.kind]}</span>
          <PlateMeat
            kind={plate.kind}
            onDragStart={(event) => onPlateDragStart(plate, event)}
          />
        </div>
      ))}
    </section>
  );
}
