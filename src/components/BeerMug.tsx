import { ASSET_PATHS } from "../game/assets";

type BeerMugProps = {
  onDrink: () => void;
};

export function BeerMug({ onDrink }: BeerMugProps) {
  return (
    <section className="beerWrap" aria-label="\u30d3\u30fc\u30eb\u30b8\u30e7\u30c3\u30ad">
      <button className="beerMug" type="button" onClick={onDrink}>
        <img
          className="beerImage"
          src={ASSET_PATHS.beer}
          alt="\u30d3\u30fc\u30eb"
          draggable={false}
        />
      </button>
    </section>
  );
}
