import type { CookLevel, MeatKind } from "./types";

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const ASSET_PATHS = {
  logo: asset("assets/images/logo/yakiniku_rush_logo.png"),
  tare: asset("assets/images/tare/tare.png"),
  vege: asset("assets/images/Vege/vege.png"),
  beer: asset("assets/images/beer/beer.png"),
  garlic: asset("assets/images/meat/garlic-0.png"),
  cutIn: {
    0: asset("assets/images/logo/cool.png"),
    1: asset("assets/images/logo/good.png"),
    2: asset("assets/images/logo/great.png"),
    3: asset("assets/images/logo/bad.png"),
  },
  resultEnd: asset("assets/images/logo/end.png"),
  grillFrames: [
    asset("assets/images/grill/ami_01.png"),
    asset("assets/images/grill/ami_02.png"),
    asset("assets/images/grill/ami_03.png"),
    asset("assets/images/grill/ami_04.png"),
    asset("assets/images/grill/ami_05.png"),
    asset("assets/images/grill/ami_06.png"),
  ],
  meat: (kind: MeatKind, level: CookLevel) =>
    asset(`assets/images/meat/${kind}-${level}.png`),
  audio: {
    title: asset("assets/audio/title.mp3"),
    countdown: asset("assets/audio/cd.mp3"),
    start: asset("assets/audio/start.mp3"),
    kettei: asset("assets/audio/kettei.mp3"),
    place: asset("assets/audio/place.mp3"),
    sizzle: [
      asset("assets/audio/niku_yaku01.mp3"),
      asset("assets/audio/niku_yaku02.mp3"),
    ],
    pickup: asset("assets/audio/pickup.mp3"),
    eatOk: asset("assets/audio/eat_ok.mp3"),
    eatNo: asset("assets/audio/eat_ng.mp3"),
    eatVege: asset("assets/audio/eat.vege.mp3"),
    drink: asset("assets/audio/drink.mp3"),
    power: asset("assets/audio/power.mp3"),
    wait: asset("assets/audio/wait.mp3"),
    bestScore: asset("assets/audio/best-score.mp3"),
    finish: asset("assets/audio/end.mp3"),
    result: asset("assets/audio/result.mp3"),
    scoreCount: asset("assets/audio/score_se.mp3"),
    resultBang: asset("assets/audio/result-bang.mp3"),
  },
} as const;
