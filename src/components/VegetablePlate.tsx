import { ASSET_PATHS } from "../game/assets";

type VegetablePlateProps = {
  onEat: () => void;
};

export function VegetablePlate({ onEat }: VegetablePlateProps) {
  return (
    <section className="vegeWrap" aria-label="\u91ce\u83dc\u76bf">
      <button className="vegePlate" type="button" onClick={onEat}>
        <img
          className="vegeImage"
          src={ASSET_PATHS.vege}
          alt="\u91ce\u83dc"
          draggable={false}
        />
      </button>
    </section>
  );
}
