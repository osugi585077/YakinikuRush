import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent,
  RefObject,
} from "react";
import { GameHud } from "./components/GameHud";
import { BeerMug } from "./components/BeerMug";
import { Grill } from "./components/Grill";
import { MeatPlates } from "./components/MeatPlates";
import { MeatVisual } from "./components/MeatPiece";
import { ResultScreen } from "./components/ResultScreen";
import { SaucePlate } from "./components/SaucePlate";
import { StartScreen } from "./components/StartScreen";
import { VegetablePlate } from "./components/VegetablePlate";
import { ASSET_PATHS } from "./game/assets";
import {
  COUNTDOWN_DURATION_MS,
  ENDING_MESSAGE_MS,
  GAME_DURATION_MS,
  LEVEL_LABELS,
  MAX_MEAT_ON_GRILL,
  MEAT_LABELS,
  PLATE_MEATS,
  SLOT_COUNT,
  getCookLevel,
  getMultiplier,
  getScore,
  isComboLevel,
} from "./game/rules";
import { readHighScore, writeHighScore } from "./game/storage";
import type {
  CookLevel,
  DragState,
  GamePhase,
  GrillMeat,
  PlateMeat,
} from "./game/types";

const BEST_SCORE_TEXT = "\u30d9\u30b9\u30c8\u30b9\u30b3\u30a2\u66f4\u65b0\uff01";
const GUIDE_TEXT =
  "\u76bf\u306e\u8089\u3092\u7db2\u3078\u30c9\u30e9\u30c3\u30b0\u3002\u713c\u3051\u305f\u3089\u30bf\u30ec\u76bf\u3078\u3002";
const ENDING_TEXT = "\u3054\u3061\u305d\u3046\u3055\u307e\u3067\u3057\u305f\uff01";
const GAME_TICK_MS = 100;

type AudioEngine = {
  bgmVolume: number;
  seVolume: number;
  unlocked: boolean;
  sePools: Partial<Record<SeKey, HTMLAudioElement[]>>;
  audioContext: AudioContext | null;
  sizzleBuffers: AudioBuffer[];
  sizzleBufferPromise: Promise<AudioBuffer[]> | null;
  seBuffers: Partial<Record<SeKey, AudioBuffer>>;
  seBufferPromise: Promise<void> | null;
  cookingGain: GainNode | null;
  cookingSource: AudioBufferSourceNode | null;
  cookingRequested: boolean;
  cookingStarting: boolean;
  title: HTMLAudioElement;
  countdown: HTMLAudioElement;
  start: HTMLAudioElement;
  kettei: HTMLAudioElement;
  finish: HTMLAudioElement;
  eatOk: HTMLAudioElement;
  eatNo: HTMLAudioElement;
  eatVege: HTMLAudioElement;
  drink: HTMLAudioElement;
  power: HTMLAudioElement;
  wait: HTMLAudioElement;
  result: HTMLAudioElement;
  scoreCount: HTMLAudioElement;
  sizzle: HTMLAudioElement[];
  cooking: HTMLAudioElement | null;
};

const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_SE_VOLUME = 1;
const STEAK_CHANCE = 0.2;
const GARLIC_SCORE_THRESHOLD = 3_000;
const SCORE_BOOST_MS = 10_000;
const POWER_NOTICE_MS = 1_100;
const POWER_FLASH_MS = 950;

type GarlicItem = {
  id: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
};

type SeKey =
  | "countdown"
  | "start"
  | "kettei"
  | "finish"
  | "eatOk"
  | "eatNo"
  | "eatVege"
  | "drink"
  | "power";

const SE_SOURCES: Record<SeKey, string> = {
  countdown: ASSET_PATHS.audio.countdown,
  start: ASSET_PATHS.audio.start,
  kettei: ASSET_PATHS.audio.kettei,
  finish: ASSET_PATHS.audio.finish,
  eatOk: ASSET_PATHS.audio.eatOk,
  eatNo: ASSET_PATHS.audio.eatNo,
  eatVege: ASSET_PATHS.audio.eatVege,
  drink: ASSET_PATHS.audio.drink,
  power: ASSET_PATHS.audio.power,
};

function createAudio(src: string, volume: number) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = volume;
  return audio;
}

function createAudioPool(src: string, volume: number, size = 4) {
  return Array.from({ length: size }, () => createAudio(src, volume));
}

function getAudioContext(engine: AudioEngine) {
  if (!engine.audioContext) {
    engine.audioContext = new AudioContext();
  }

  return engine.audioContext;
}

async function loadSizzleBuffers(engine: AudioEngine) {
  if (engine.sizzleBuffers.length > 0) return engine.sizzleBuffers;
  if (!engine.sizzleBufferPromise) {
    const context = getAudioContext(engine);
    engine.sizzleBufferPromise = Promise.all(
      ASSET_PATHS.audio.sizzle.map(async (source) => {
        const response = await fetch(source);
        const buffer = await response.arrayBuffer();
        return context.decodeAudioData(buffer);
      }),
    ).then((buffers) => {
      engine.sizzleBuffers = buffers;
      return buffers;
    });
  }

  return engine.sizzleBufferPromise;
}

async function loadSeBuffers(engine: AudioEngine) {
  if (Object.keys(SE_SOURCES).every((key) => engine.seBuffers[key as SeKey])) {
    return;
  }

  if (!engine.seBufferPromise) {
    const context = getAudioContext(engine);

    engine.seBufferPromise = Promise.all(
      Object.entries(SE_SOURCES).map(async ([key, source]) => {
        const response = await fetch(source);
        const buffer = await response.arrayBuffer();
        engine.seBuffers[key as SeKey] = await context.decodeAudioData(buffer);
      }),
    ).then(() => undefined);
  }

  return engine.seBufferPromise;
}

function getAudioEngine(ref: MutableRefObject<AudioEngine | null>) {
  if (!ref.current) {
    ref.current = {
      bgmVolume: DEFAULT_BGM_VOLUME,
      seVolume: DEFAULT_SE_VOLUME,
      unlocked: false,
      audioContext: null,
      sizzleBuffers: [],
      sizzleBufferPromise: null,
      seBuffers: {},
      seBufferPromise: null,
      cookingGain: null,
      cookingSource: null,
      cookingRequested: false,
      cookingStarting: false,
      sePools: {
        countdown: createAudioPool(ASSET_PATHS.audio.countdown, DEFAULT_SE_VOLUME),
        start: createAudioPool(ASSET_PATHS.audio.start, DEFAULT_SE_VOLUME * 0.96),
        kettei: createAudioPool(ASSET_PATHS.audio.kettei, DEFAULT_SE_VOLUME * 0.85),
        finish: createAudioPool(ASSET_PATHS.audio.finish, DEFAULT_SE_VOLUME * 0.96),
        eatOk: createAudioPool(ASSET_PATHS.audio.eatOk, DEFAULT_SE_VOLUME * 0.96),
        eatNo: createAudioPool(ASSET_PATHS.audio.eatNo, DEFAULT_SE_VOLUME * 0.96),
        eatVege: createAudioPool(ASSET_PATHS.audio.eatVege, DEFAULT_SE_VOLUME),
        drink: createAudioPool(ASSET_PATHS.audio.drink, DEFAULT_SE_VOLUME * 0.95),
        power: createAudioPool(ASSET_PATHS.audio.power, DEFAULT_SE_VOLUME),
      },
      title: createAudio(ASSET_PATHS.audio.title, DEFAULT_BGM_VOLUME * 0.7),
      countdown: createAudio(ASSET_PATHS.audio.countdown, DEFAULT_SE_VOLUME),
      start: createAudio(ASSET_PATHS.audio.start, DEFAULT_SE_VOLUME * 0.96),
      kettei: createAudio(ASSET_PATHS.audio.kettei, DEFAULT_SE_VOLUME * 0.85),
      finish: createAudio(ASSET_PATHS.audio.finish, DEFAULT_SE_VOLUME * 0.96),
      eatOk: createAudio(ASSET_PATHS.audio.eatOk, DEFAULT_SE_VOLUME * 0.96),
      eatNo: createAudio(ASSET_PATHS.audio.eatNo, DEFAULT_SE_VOLUME * 0.96),
      eatVege: createAudio(ASSET_PATHS.audio.eatVege, DEFAULT_SE_VOLUME),
      drink: createAudio(ASSET_PATHS.audio.drink, DEFAULT_SE_VOLUME * 0.95),
      power: createAudio(ASSET_PATHS.audio.power, DEFAULT_SE_VOLUME),
      wait: createAudio(ASSET_PATHS.audio.wait, DEFAULT_BGM_VOLUME),
      result: createAudio(ASSET_PATHS.audio.result, DEFAULT_BGM_VOLUME * 0.95),
      scoreCount: createAudio(ASSET_PATHS.audio.scoreCount, DEFAULT_SE_VOLUME),
      sizzle: ASSET_PATHS.audio.sizzle.map((source) =>
        createAudio(source, DEFAULT_BGM_VOLUME * 0.65),
      ),
      cooking: null,
    };
    ref.current.title.loop = true;
    ref.current.wait.loop = true;
    ref.current.sizzle.forEach((audio) => {
      audio.loop = true;
    });
  }

  return ref.current;
}

function applyAudioVolumes(engine: AudioEngine) {
  engine.title.volume = engine.bgmVolume * 0.7;
  engine.wait.volume = engine.bgmVolume;
  engine.result.volume = engine.bgmVolume * 0.95;
  if (engine.cookingGain) {
    engine.cookingGain.gain.value = engine.bgmVolume * 0.65;
  }
  if (engine.cooking) {
    engine.cooking.volume = engine.bgmVolume * 0.65;
  }
  engine.sizzle.forEach((audio) => {
    audio.volume = engine.bgmVolume * 0.65;
  });

  engine.countdown.volume = engine.seVolume;
  engine.start.volume = engine.seVolume * 0.96;
  engine.kettei.volume = engine.seVolume * 0.85;
  engine.finish.volume = engine.seVolume * 0.96;
  engine.eatOk.volume = engine.seVolume * 0.96;
  engine.eatNo.volume = engine.seVolume * 0.96;
  engine.eatVege.volume = engine.seVolume;
  engine.drink.volume = engine.seVolume * 0.95;
  engine.power.volume = engine.seVolume;
  engine.scoreCount.volume = engine.seVolume;
  engine.sePools.eatOk?.forEach((audio) => {
    audio.volume = engine.seVolume * 0.96;
  });
  engine.sePools.eatNo?.forEach((audio) => {
    audio.volume = engine.seVolume * 0.96;
  });
  engine.sePools.eatVege?.forEach((audio) => {
    audio.volume = engine.seVolume;
  });
  engine.sePools.drink?.forEach((audio) => {
    audio.volume = engine.seVolume * 0.95;
  });
  engine.sePools.power?.forEach((audio) => {
    audio.volume = engine.seVolume;
  });
  engine.sePools.countdown?.forEach((audio) => {
    audio.volume = engine.seVolume;
  });
  engine.sePools.start?.forEach((audio) => {
    audio.volume = engine.seVolume * 0.96;
  });
  engine.sePools.kettei?.forEach((audio) => {
    audio.volume = engine.seVolume * 0.85;
  });
  engine.sePools.finish?.forEach((audio) => {
    audio.volume = engine.seVolume * 0.96;
  });
}

function playOneShot(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function playPooledOneShot(pool: HTMLAudioElement[] | undefined) {
  const audio = pool?.find((item) => item.paused) ?? pool?.[0];
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function playBufferedSe(engine: AudioEngine, key: SeKey) {
  const buffer = engine.seBuffers[key];
  if (!buffer) {
    playPooledOneShot(engine.sePools[key]);
    return;
  }

  const context = getAudioContext(engine);
  void context.resume().catch(() => {});

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value =
    key === "drink"
      ? engine.seVolume * 0.95
      : key === "kettei"
        ? engine.seVolume * 0.85
        : key === "eatOk" ||
            key === "eatNo" ||
            key === "start" ||
            key === "finish"
        ? engine.seVolume * 0.96
        : engine.seVolume;
  source.connect(gain);
  gain.connect(context.destination);
  source.start();
}

function unlockAudio(engine: AudioEngine) {
  if (engine.unlocked) return;
  engine.unlocked = true;

  const context = getAudioContext(engine);
  void context.resume().catch(() => {});
  void loadSizzleBuffers(engine).catch(() => {});
  void loadSeBuffers(engine).catch(() => {});
  engine.wait.load();
  engine.result.load();
}

function stopCookingSound(engine: AudioEngine) {
  engine.cookingRequested = false;
  engine.cookingStarting = false;

  if (engine.cookingSource) {
    try {
      engine.cookingSource.stop();
    } catch {
      // Already stopped.
    }
    engine.cookingSource.disconnect();
    engine.cookingSource = null;
  }

  if (!engine.cooking) return;

  engine.cooking.pause();
  engine.cooking.currentTime = 0;
  engine.cooking = null;
}

function startWaitSound(engine: AudioEngine) {
  if (!engine.wait.paused) return;
  engine.wait.currentTime = 0;
  void engine.wait.play().catch(() => {});
}

function stopWaitSound(engine: AudioEngine) {
  engine.wait.pause();
  engine.wait.currentTime = 0;
}

function startTitleSound(engine: AudioEngine) {
  if (!engine.title.paused) return;
  if (engine.title.currentTime === 0 || engine.title.ended) {
    engine.title.currentTime = 0;
  }
  void engine.title.play().catch(() => {});
}

function prepareTitleSound(engine: AudioEngine) {
  if (engine.title.readyState === 0) {
    engine.title.load();
  }
  startTitleSound(engine);
}

function stopTitleSound(engine: AudioEngine) {
  engine.title.pause();
  engine.title.currentTime = 0;
}

function playRandomCookingSound(engine: AudioEngine) {
  void startCookingLoop(engine);
}

async function startCookingLoop(engine: AudioEngine) {
  if (engine.cookingSource || engine.cookingStarting) return;
  engine.cookingRequested = true;
  engine.cookingStarting = true;

  try {
    const context = getAudioContext(engine);
    await context.resume();
    const buffers = await loadSizzleBuffers(engine);
    if (!engine.cookingRequested || engine.cookingSource || buffers.length === 0) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
    source.loop = true;

    const gain = engine.cookingGain ?? context.createGain();
    gain.gain.value = engine.bgmVolume * 0.65;
    gain.connect(context.destination);

    source.connect(gain);
    source.start();
    engine.cookingGain = gain;
    engine.cookingSource = source;
  } catch {
    if (!engine.cookingRequested) return;
    const audio =
      engine.sizzle[Math.floor(Math.random() * engine.sizzle.length)];
    audio.volume = engine.bgmVolume * 0.65;
    audio.currentTime = 0;
    engine.cooking = audio;
    void audio.play().catch(() => {});
  } finally {
    engine.cookingStarting = false;
  }
}

function startCookingSound(engine: AudioEngine) {
  if (engine.cooking) return;
  playRandomCookingSound(engine);
}

function createGrillMeat(
  id: number,
  kind: PlateMeat["kind"],
  slot: number,
): GrillMeat {
  return {
    id,
    kind,
    slot,
    ageMs: 0,
    rotation: Math.floor(Math.random() * 70) - 35,
    scale: 0.92 + Math.random() * 0.16,
  };
}

function choosePlateMeatKind(kind: PlateMeat["kind"]) {
  return Math.random() < STEAK_CHANCE ? "steak" : kind;
}

function createGarlicItem(): GarlicItem {
  const edge = Math.floor(Math.random() * 4);
  const main = 14 + Math.random() * 72;
  const position = [
    { x: main, y: 16 },
    { x: 84, y: main },
    { x: main, y: 84 },
    { x: 16, y: main },
  ][edge];

  return {
    id: Date.now(),
    x: position.x,
    y: position.y,
    driftX: Math.round((Math.random() * 34 - 17) * 10) / 10,
    driftY: Math.round((Math.random() * 28 - 14) * 10) / 10,
  };
}

function pointIsInside(
  ref: RefObject<HTMLElement | null>,
  x: number,
  y: number,
) {
  const element = ref.current;
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function getSlotFromPoint(
  ref: RefObject<HTMLElement | null>,
  x: number,
  y: number,
  occupiedSlots: number[],
) {
  const element = ref.current;
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const column = Math.min(
    2,
    Math.max(0, Math.floor(((x - rect.left) / rect.width) * 3)),
  );
  const row = Math.min(
    2,
    Math.max(0, Math.floor(((y - rect.top) / rect.height) * 3)),
  );
  const preferredSlot = row * 3 + column;

  if (!occupiedSlots.includes(preferredSlot)) return preferredSlot;

  return (
    Array.from({ length: SLOT_COUNT }, (_, slot) => slot).find(
      (slot) => !occupiedSlots.includes(slot),
    ) ?? null
  );
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("ready");
  const [meats, setMeats] = useState<GrillMeat[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [perfectCombo, setPerfectCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS);
  const [countdownMs, setCountdownMs] = useState(COUNTDOWN_DURATION_MS);
  const [scoreEvent, setScoreEvent] = useState<{
    label: string;
    points: number;
    multiplier: number;
  } | null>(null);
  const [eatFeedback, setEatFeedback] = useState<{
    id: number;
    level: CookLevel;
    points: number;
    combo: number;
  } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [highScore, setHighScore] = useState(() => readHighScore());
  const [lastRunWasRecord, setLastRunWasRecord] = useState(false);
  const [bestNoticeVisible, setBestNoticeVisible] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(DEFAULT_BGM_VOLUME);
  const [seVolume, setSeVolume] = useState(DEFAULT_SE_VOLUME);
  const [garlic, setGarlic] = useState<GarlicItem | null>(null);
  const [scoreBoostActive, setScoreBoostActive] = useState(false);
  const [powerNoticeVisible, setPowerNoticeVisible] = useState(false);
  const [powerFlashActive, setPowerFlashActive] = useState(false);
  const [finalCountdownNumber, setFinalCountdownNumber] = useState<number | null>(
    null,
  );
  const nextMeatId = useRef(1);
  const lastTick = useRef<number | null>(null);
  const tickRemainder = useRef(0);
  const meatsRef = useRef<GrillMeat[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const grillRef = useRef<HTMLDivElement | null>(null);
  const sauceRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const eatFeedbackTimerRef = useRef<number | null>(null);
  const garlicSpawnedRef = useRef(false);
  const scoreBoostActiveRef = useRef(false);
  const scoreBoostTimerRef = useRef<number | null>(null);
  const powerNoticeTimerRef = useRef<number | null>(null);
  const powerFlashTimerRef = useRef<number | null>(null);
  const finalCountdownSecondRef = useRef<number | null>(null);

  const multiplier = useMemo(() => getMultiplier(combo), [combo]);

  useEffect(() => {
    meatsRef.current = meats;
  }, [meats]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    scoreBoostActiveRef.current = scoreBoostActive;
  }, [scoreBoostActive]);

  useEffect(() => {
    const unlockTitleAudio = () => {
      if (phase !== "ready") return;
      const engine = getAudioEngine(audioRef);
      unlockAudio(engine);
      prepareTitleSound(engine);
    };

    window.addEventListener("pointerdown", unlockTitleAudio);
    window.addEventListener("click", unlockTitleAudio);
    window.addEventListener("keydown", unlockTitleAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockTitleAudio);
      window.removeEventListener("click", unlockTitleAudio);
      window.removeEventListener("keydown", unlockTitleAudio);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") return;

    const engine = getAudioEngine(audioRef);
    const timers: number[] = [];

    setCountdownMs(COUNTDOWN_DURATION_MS);
    playBufferedSe(engine, "countdown");

    timers.push(
      window.setTimeout(() => {
        setCountdownMs(2_000);
        playBufferedSe(engine, "countdown");
      }, 1_000),
    );
    timers.push(
      window.setTimeout(() => {
        setCountdownMs(1_000);
        playBufferedSe(engine, "countdown");
      }, 2_000),
    );
    timers.push(
      window.setTimeout(() => {
        setCountdownMs(0);
        playBufferedSe(engine, "finish");
        lastTick.current = null;
        tickRemainder.current = 0;
        setPhase("playing");
      }, COUNTDOWN_DURATION_MS),
    );

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;

    let frameId = 0;

    const tick = (now: number) => {
      const previous = lastTick.current ?? now;
      const delta = now - previous;
      lastTick.current = now;
      tickRemainder.current += delta;

      if (tickRemainder.current < GAME_TICK_MS) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const elapsed = tickRemainder.current;
      tickRemainder.current = 0;

      setTimeLeftMs((current) => {
        const next = Math.max(0, current - elapsed);
        const nextSecond = Math.ceil(next / 1000);

        if (
          next > 0 &&
          next <= 5_000 &&
          nextSecond !== finalCountdownSecondRef.current
        ) {
          finalCountdownSecondRef.current = nextSecond;
          setFinalCountdownNumber(nextSecond);
          playBufferedSe(getAudioEngine(audioRef), "countdown");
        }

        if (next === 0) {
          finalCountdownSecondRef.current = 0;
          setFinalCountdownNumber(null);
          setPhase("ending");
        }
        return next;
      });

      setMeats((current) =>
        current.map((meat) => ({
          ...meat,
          ageMs: meat.ageMs + elapsed,
        })),
      );

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      lastTick.current = null;
      tickRemainder.current = 0;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "ending") return;

    const engine = getAudioEngine(audioRef);
    stopCookingSound(engine);
    stopWaitSound(engine);
    stopTitleSound(engine);
    playBufferedSe(engine, "finish");
    setDrag(null);
    setGarlic(null);
    clearScoreBoost();
    setFinalCountdownNumber(null);

    const timerId = window.setTimeout(() => {
      setPhase("finished");
    }, ENDING_MESSAGE_MS);

    return () => window.clearTimeout(timerId);
  }, [phase]);

  useEffect(() => {
    if (phase === "ready") {
      prepareTitleSound(getAudioEngine(audioRef));
      return;
    }

    const engine = audioRef.current;
    if (!engine) return;

    if (phase === "playing" && meats.length > 0) {
      stopTitleSound(engine);
      stopWaitSound(engine);
      startCookingSound(engine);
      return;
    }

    if (phase === "playing") {
      stopTitleSound(engine);
      stopCookingSound(engine);
      startWaitSound(engine);
      return;
    }

    stopCookingSound(engine);
    stopWaitSound(engine);
    stopTitleSound(engine);
  }, [phase, meats.length]);

  useEffect(() => {
    if (phase !== "finished") return;

    const previousHigh = readHighScore();
    writeHighScore(score);
    const nextHigh = Math.max(previousHigh, score);
    setHighScore(nextHigh);
    setLastRunWasRecord(score > previousHigh);
    setDrag(null);
    playOneShot(getAudioEngine(audioRef).result);
  }, [phase, score]);

  const dragSource =
    drag?.source.type === "plate"
      ? `plate-${drag.source.plateId}`
      : drag?.source.type === "grill"
        ? `grill-${drag.source.id}`
        : null;

  useEffect(() => {
    if (!drag) return;

    let dragFrameId = 0;
    let nextDragPoint = {
      x: drag.x,
      y: drag.y,
    };

    const updateDragPoint = () => {
      dragFrameId = 0;
      setDrag((current) =>
        current
          ? {
              ...current,
              ...nextDragPoint,
            }
          : null,
      );
    };

    const handleMove = (event: globalThis.PointerEvent) => {
      event.preventDefault();
      nextDragPoint = {
        x: event.clientX,
        y: event.clientY,
      };

      if (dragFrameId === 0) {
        dragFrameId = window.requestAnimationFrame(updateDragPoint);
      }
    };

    const handleUp = (event: globalThis.PointerEvent) => {
      event.preventDefault();
      finishDrag(event.clientX, event.clientY);
    };

    const blockTouchMove = (event: TouchEvent) => {
      event.preventDefault();
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp, { once: true });
    window.addEventListener("pointercancel", handleUp, { once: true });
    window.addEventListener("touchmove", blockTouchMove, { passive: false });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("touchmove", blockTouchMove);
      if (dragFrameId !== 0) {
        window.cancelAnimationFrame(dragFrameId);
      }
    };
  }, [dragSource]);

  useEffect(() => {
    return () => {
      if (eatFeedbackTimerRef.current !== null) {
        window.clearTimeout(eatFeedbackTimerRef.current);
      }
      if (scoreBoostTimerRef.current !== null) {
        window.clearTimeout(scoreBoostTimerRef.current);
      }
      if (powerNoticeTimerRef.current !== null) {
        window.clearTimeout(powerNoticeTimerRef.current);
      }
      if (powerFlashTimerRef.current !== null) {
        window.clearTimeout(powerFlashTimerRef.current);
      }
    };
  }, []);

  function startGame(playStartSound = true) {
    const engine = getAudioEngine(audioRef);
    unlockAudio(engine);
    stopCookingSound(engine);
    stopWaitSound(engine);
    stopTitleSound(engine);
    clearEatFeedback();
    if (playStartSound) {
      playBufferedSe(engine, "start");
    }

    setPhase("countdown");
    setMeats([]);
    setScore(0);
    setCombo(0);
    setPerfectCombo(0);
    setBestCombo(0);
    setScoreEvent(null);
    setEatFeedback(null);
    setTimeLeftMs(GAME_DURATION_MS);
    setCountdownMs(COUNTDOWN_DURATION_MS);
    setLastRunWasRecord(false);
    setBestNoticeVisible(false);
    setGarlic(null);
    clearScoreBoost();
    setFinalCountdownNumber(null);
    setDrag(null);
    nextMeatId.current = 1;
    garlicSpawnedRef.current = false;
    finalCountdownSecondRef.current = null;
    lastTick.current = null;
    tickRemainder.current = 0;
  }

  function restartGame() {
    const engine = getAudioEngine(audioRef);
    playBufferedSe(engine, "kettei");
    startGame(false);
  }

  function togglePause() {
    const engine = getAudioEngine(audioRef);

    if (phase === "playing") {
      stopCookingSound(engine);
      stopWaitSound(engine);
      setDrag(null);
      setPhase("paused");
      return;
    }

    if (phase === "paused") {
      lastTick.current = null;
      tickRemainder.current = 0;
      setPhase("playing");
      if (meats.length === 0) {
        startWaitSound(engine);
      }
    }
  }

  function changeBgmVolume(value: number) {
    setBgmVolume(value);
    const engine = getAudioEngine(audioRef);
    engine.bgmVolume = value;
    applyAudioVolumes(engine);
  }

  function changeSeVolume(value: number) {
    setSeVolume(value);
    const engine = getAudioEngine(audioRef);
    engine.seVolume = value;
    applyAudioVolumes(engine);
  }

  function returnToTitle() {
    const engine = getAudioEngine(audioRef);
    playBufferedSe(engine, "kettei");
    stopCookingSound(engine);
    stopWaitSound(engine);
    startTitleSound(engine);
    clearEatFeedback();
    setPhase("ready");
    setMeats([]);
    setCombo(0);
    setPerfectCombo(0);
    setScoreEvent(null);
    setEatFeedback(null);
    setGarlic(null);
    clearScoreBoost();
    setDrag(null);
    setTimeLeftMs(GAME_DURATION_MS);
    setCountdownMs(COUNTDOWN_DURATION_MS);
    garlicSpawnedRef.current = false;
    finalCountdownSecondRef.current = null;
    setFinalCountdownNumber(null);
    lastTick.current = null;
    tickRemainder.current = 0;
  }

  function beginPlateDrag(
    plate: PlateMeat,
    event: PointerEvent<HTMLElement>,
  ) {
    if (phase !== "playing") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const kind = choosePlateMeatKind(plate.kind);
    setDrag({
      source: { type: "plate", plateId: plate.plateId, kind },
      x: event.clientX,
      y: event.clientY,
    });
  }

  function beginGrillDrag(id: number, event: PointerEvent<HTMLElement>) {
    if (phase !== "playing") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      source: { type: "grill", id },
      x: event.clientX,
      y: event.clientY,
    });
  }

  function finishDrag(x: number, y: number) {
    const currentDrag = dragRef.current;

    if (!currentDrag || phase !== "playing") {
      setDrag(null);
      return;
    }

    const source = currentDrag.source;

    if (source.type === "plate" && pointIsInside(grillRef, x, y)) {
      setMeats((current) => {
        if (current.length >= MAX_MEAT_ON_GRILL) return current;

        const slot = getSlotFromPoint(
          grillRef,
          x,
          y,
          current.map((item) => item.slot),
        );

        if (slot === null) return current;

        const meat = createGrillMeat(nextMeatId.current, source.kind, slot);
        nextMeatId.current += 1;
        return [...current, meat];
      });
    }

    if (source.type === "grill" && pointIsInside(sauceRef, x, y)) {
      eatMeat(source.id);
    }

    setDrag(null);
  }

  function eatMeat(id: number) {
    const meat = meatsRef.current.find((item) => item.id === id);
    if (!meat) return;

    const level = getCookLevel(meat.kind, meat.ageMs);
    const baseScore = getScore(meat.kind, level);
    const nextCombo = isComboLevel(level) && baseScore > 0 ? combo + 1 : 0;
    const nextMultiplier = getMultiplier(nextCombo);
    const comboScore = Math.round(baseScore * nextMultiplier);
    const earned =
      scoreBoostActiveRef.current && comboScore > 0 ? comboScore * 2 : comboScore;
    const engine = getAudioEngine(audioRef);
    playBufferedSe(engine, isComboLevel(level) ? "eatOk" : "eatNo");

    setMeats((current) => current.filter((item) => item.id !== id));
    setScore((current) => {
      const nextScore = current + earned;
      if (current <= highScore && nextScore > highScore) {
        setHighScore(nextScore);
        writeHighScore(nextScore);
        setBestNoticeVisible(true);
        window.setTimeout(() => setBestNoticeVisible(false), 1800);
      }
      if (!garlicSpawnedRef.current && nextScore >= GARLIC_SCORE_THRESHOLD) {
        garlicSpawnedRef.current = true;
        setGarlic(createGarlicItem());
      }
      return nextScore;
    });
    setCombo(nextCombo);
    setPerfectCombo((current) => (level === 2 ? current + 1 : 0));
    setBestCombo((current) => Math.max(current, nextCombo));
    setScoreEvent({
      label: `${MEAT_LABELS[meat.kind]} ${LEVEL_LABELS[level]}`,
      points: earned,
      multiplier:
        scoreBoostActiveRef.current && comboScore > 0
          ? nextMultiplier * 2
          : nextMultiplier,
    });
    showEatFeedback(level, earned, level === 2 ? perfectCombo + 1 : 0);
  }

  function showEatFeedback(level: CookLevel, points: number, feedbackCombo: number) {
    clearEatFeedback();

    setEatFeedback({
      id: Date.now(),
      level,
      points,
      combo: feedbackCombo,
    });

    eatFeedbackTimerRef.current = window.setTimeout(() => {
      setEatFeedback(null);
      eatFeedbackTimerRef.current = null;
    }, 1000);
  }

  function clearEatFeedback() {
    if (eatFeedbackTimerRef.current !== null) {
      window.clearTimeout(eatFeedbackTimerRef.current);
      eatFeedbackTimerRef.current = null;
    }
    setEatFeedback(null);
  }

  function collectGarlic() {
    if (!garlic || phase !== "playing") return;
    const engine = getAudioEngine(audioRef);
    playBufferedSe(engine, "power");
    setGarlic(null);
    setScoreBoostActive(true);
    setPowerNoticeVisible(true);
    setPowerFlashActive(true);
    scoreBoostActiveRef.current = true;

    if (scoreBoostTimerRef.current !== null) {
      window.clearTimeout(scoreBoostTimerRef.current);
    }
    if (powerNoticeTimerRef.current !== null) {
      window.clearTimeout(powerNoticeTimerRef.current);
    }
    if (powerFlashTimerRef.current !== null) {
      window.clearTimeout(powerFlashTimerRef.current);
    }

    scoreBoostTimerRef.current = window.setTimeout(() => {
      setScoreBoostActive(false);
      scoreBoostActiveRef.current = false;
      scoreBoostTimerRef.current = null;
    }, SCORE_BOOST_MS);
    powerNoticeTimerRef.current = window.setTimeout(() => {
      setPowerNoticeVisible(false);
      powerNoticeTimerRef.current = null;
    }, POWER_NOTICE_MS);
    powerFlashTimerRef.current = window.setTimeout(() => {
      setPowerFlashActive(false);
      powerFlashTimerRef.current = null;
    }, POWER_FLASH_MS);
  }

  function clearScoreBoost() {
    if (scoreBoostTimerRef.current !== null) {
      window.clearTimeout(scoreBoostTimerRef.current);
      scoreBoostTimerRef.current = null;
    }
    scoreBoostActiveRef.current = false;
    setScoreBoostActive(false);
    clearPowerEffects();
  }

  function clearPowerEffects() {
    if (powerNoticeTimerRef.current !== null) {
      window.clearTimeout(powerNoticeTimerRef.current);
      powerNoticeTimerRef.current = null;
    }
    if (powerFlashTimerRef.current !== null) {
      window.clearTimeout(powerFlashTimerRef.current);
      powerFlashTimerRef.current = null;
    }
    setPowerNoticeVisible(false);
    setPowerFlashActive(false);
  }

  if (phase === "ready") {
    return <StartScreen highScore={highScore} onStart={() => startGame()} />;
  }

  if (phase === "finished") {
    return (
      <ResultScreen
        score={score}
        highScore={highScore}
        bestCombo={bestCombo}
        isNewRecord={lastRunWasRecord}
        onRestart={restartGame}
        onTitle={returnToTitle}
        seVolume={seVolume}
      />
    );
  }

  const countdownNumber = Math.max(1, Math.ceil(countdownMs / 1000));
  const draggingMeatId =
    drag?.source.type === "grill" ? drag.source.id : null;
  const isPaused = phase === "paused";
  const garlicStyle = garlic
    ? ({
        "--garlic-x": `${garlic.x}vw`,
        "--garlic-y": `${garlic.y}dvh`,
        "--garlic-drift-x": `${garlic.driftX}px`,
        "--garlic-drift-y": `${garlic.driftY}px`,
      } as CSSProperties)
    : undefined;

  return (
    <main className="gameShell">
      {bestNoticeVisible && (
        <div className="bestScoreToast" role="status">
          {BEST_SCORE_TEXT}
        </div>
      )}
      {eatFeedback && (
        <div
          className="eatFeedback"
          key={eatFeedback.id}
          aria-live="polite"
        >
          <img
            src={ASSET_PATHS.cutIn[eatFeedback.level]}
            alt=""
            draggable={false}
          />
          {eatFeedback.combo >= 2 && (
            <strong className="eatFeedbackCombo">{eatFeedback.combo}COMBO</strong>
          )}
          <span className="eatFeedbackPoints">
            {eatFeedback.points > 0 ? "+" : ""}
            {eatFeedback.points}
          </span>
        </div>
      )}
      {powerFlashActive && <div className="powerFlash" aria-hidden="true" />}
      {powerNoticeVisible && (
        <div className="powerNotice" role="status">
          スコア2倍!!
        </div>
      )}
      {garlic && phase === "playing" && (
        <button
          className="garlicItem"
          type="button"
          style={garlicStyle}
          onClick={collectGarlic}
          aria-label="ニンニクを取る"
        >
          <img src={ASSET_PATHS.garlic} alt="" draggable={false} />
        </button>
      )}
      <GameHud
        score={score}
        highScore={highScore}
        combo={combo}
        multiplier={multiplier}
        timeLeftMs={timeLeftMs}
      />
      <button className="pauseButton" type="button" onClick={togglePause}>
        MENU
      </button>
      <div className="playArea">
        <Grill
          meats={meats}
          grillRef={grillRef}
          draggingMeatId={draggingMeatId}
          onMeatDragStart={beginGrillDrag}
        />
        <div className="sideDishRow">
          <VegetablePlate
            onEat={() =>
              playBufferedSe(getAudioEngine(audioRef), "eatVege")
            }
          />
          <SaucePlate sauceRef={sauceRef} />
          <BeerMug
            onDrink={() =>
              playBufferedSe(getAudioEngine(audioRef), "drink")
            }
          />
        </div>
      </div>
      <MeatPlates plates={PLATE_MEATS} onPlateDragStart={beginPlateDrag} />
      <footer className="feedbackBar" aria-live="polite">
        {scoreEvent ? (
          <span className="eventText">
            {scoreEvent.label} {scoreEvent.points > 0 ? "+" : ""}
            {scoreEvent.points} x{scoreEvent.multiplier.toFixed(2)}
          </span>
        ) : (
          <span>{GUIDE_TEXT}</span>
        )}
      </footer>
      {phase === "countdown" && (
        <div className="centerOverlay countdownOverlay" aria-live="assertive">
          <span>{countdownNumber}</span>
        </div>
      )}
      {phase === "playing" && finalCountdownNumber !== null && (
        <div className="centerOverlay finalCountdownOverlay" aria-live="assertive">
          <span>{finalCountdownNumber}</span>
        </div>
      )}
      {isPaused && (
        <div className="centerOverlay menuOverlay" aria-live="assertive">
          <section className="menuPanel" aria-label="MENU">
            <h2>MENU</h2>
            <label>
              <span>BGM</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bgmVolume}
                onChange={(event) => changeBgmVolume(Number(event.target.value))}
              />
            </label>
            <label>
              <span>SE</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={seVolume}
                onChange={(event) => changeSeVolume(Number(event.target.value))}
              />
            </label>
            <button className="primaryButton" type="button" onClick={togglePause}>
              RESUME
            </button>
          </section>
        </div>
      )}
      {phase === "ending" && (
        <div className="centerOverlay endingOverlay" aria-live="assertive">
          {ENDING_TEXT}
        </div>
      )}
      {drag && (
        <div
          className="dragGhost"
          style={{
            left: drag.x,
            top: drag.y,
          }}
        >
          {drag.source.type === "plate" ? (
            <MeatVisual kind={drag.source.kind} level={0} />
          ) : (
            (() => {
              const source = drag.source;
              if (source.type !== "grill") return null;
              const meat = meats.find((item) => item.id === source.id);
              if (!meat) return null;
              return (
                <MeatVisual
                  kind={meat.kind}
                  level={getCookLevel(meat.kind, meat.ageMs)}
                  rotation={meat.rotation}
                  scale={meat.scale}
                />
              );
            })()
          )}
        </div>
      )}
    </main>
  );
}
