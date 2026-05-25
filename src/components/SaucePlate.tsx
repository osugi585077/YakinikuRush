import type { RefObject } from "react";
import { ASSET_PATHS } from "../game/assets";

type SaucePlateProps = {
  sauceRef: RefObject<HTMLDivElement | null>;
};

export function SaucePlate({ sauceRef }: SaucePlateProps) {
  return (
    <section className="sauceWrap" aria-label="\u30bf\u30ec\u76bf">
      <div className="saucePlate" ref={sauceRef}>
        <img
          className="sauceImage"
          src={ASSET_PATHS.tare}
          alt="\u30bf\u30ec"
          draggable={false}
        />
      </div>
    </section>
  );
}
