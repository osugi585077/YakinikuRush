import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, PointerEvent, RefObject } from "react";
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
  sePools: Partial<Record<"eatOk" | "eatNo" | "eatVege" | "drink", HTMLAudioElement[]>>;
  audioContext: AudioContext | null;
  sizzleBuffers: AudioBuffer[];
  sizzleBufferPromise: Promise<AudioBuffer[]> | null;
  seBuffers: Partial<Record<"eatOk" | "eatNo" | "eatVege" | "drink", AudioBuffer>>;
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
  wait: HTMLAudioElement;
  result: HTMLAudioElement;
  scoreCount: HTMLAudioElement;
  sizzle: HTMLAudioElement[];
  cooking: HTMLAudioElement | null;
};

const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_SE_VOLUME = 1;

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
  if (
    engine.seBuffers.eatOk &&
    engine.seBuffers.eatNo &&
    engine.seBuffers.eatVege &&
    engine.seBuffers.drink
  ) {
    return;
  }

  if (!engine.seBufferPromise) {
    const context = getAudioContext(engine);
    const entries = [
      ["eatOk", ASSET_PATHS.audio.eatOk],
      ["eatNo", ASSET_PATHS.audio.eatNo],
      ["eatVege", ASSET_PATHS.audio.eatVege],
      ["drink", ASSET_PATHS.audio.drink],
    ] as const;

    engine.seBufferPromise = Promise.all(
      entries.map(async ([key, source]) => {
        const response = await fetch(source);
        const buffer = await response.arrayBuffer();
        engine.seBuffers[key] = await context.decodeAudioData(buffer);
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
        eatOk: createAudioPool(ASSET_PATHS.audio.eatOk, DEFAULT_SE_VOLUME * 0.96),
        eatNo: createAudioPool(ASSET_PATHS.audio.eatNo, DEFAULT_SE_VOLUME * 0.96),
        eatVege: createAudioPool(ASSET_PATHS.audio.eatVege, DEFAULT_SE_VOLUME),
        drink: createAudioPool(ASSET_PATHS.audio.drink, DEFAULT_SE_VOLUME * 0.95),
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

function playBufferedSe(
  engine: AudioEngine,
  key: "eatOk" | "eatNo" | "eatVege" | "drink",
) {
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
      : key === "eatOk" || key === "eatNo"
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
  const nextMeatId = useRef(1);
  const lastTick = useRef<number | null>(null);
  const tickRemainder = useRef(0);
  const meatsRef = useRef<GrillMeat[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const grillRef = useRef<HTMLDivElement | null>(null);
  const sauceRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const eatFeedbackTimerRef = useRef<number | null>(null);

  const multiplier = useMemo(() => getMultiplier(combo), [combo]);

  useEffect(() => {
    meatsRef.current = meats;
  }, [meats]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

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
    playOneShot(engine.countdown);

    timers.push(
      window.setTimeout(() => {
        setCountdownMs(2_000);
        playOneShot(engine.countdown);
      }, 1_000),
    );
    timers.push(
      window.setTimeout(() => {
        setCountdownMs(1_000);
        playOneShot(engine.countdown);
      }, 2_000),
    );
    timers.push(
      window.setTimeout(() => {
        setCountdownMs(0);
        playOneShot(engine.finish);
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
        if (next === 0) {
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
    playOneShot(engine.finish);
    setDrag(null);

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
      playOneShot(engine.start);
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
    setDrag(null);
    nextMeatId.current = 1;
    lastTick.current = null;
    tickRemainder.current = 0;
  }

  function restartGame() {
    const engine = getAudioEngine(audioRef);
    playOneShot(engine.kettei);
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
    playOneShot(engine.kettei);
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
    setDrag(null);
    setTimeLeftMs(GAME_DURATION_MS);
    setCountdownMs(COUNTDOWN_DURATION_MS);
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
    setDrag({
      source: { type: "plate", plateId: plate.plateId, kind: plate.kind },
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
    const earned = Math.round(baseScore * nextMultiplier);
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
      return nextScore;
    });
    setCombo(nextCombo);
    setPerfectCombo((current) => (level === 2 ? current + 1 : 0));
    setBestCombo((current) => Math.max(current, nextCombo));
    setScoreEvent({
      label: `${MEAT_LABELS[meat.kind]} ${LEVEL_LABELS[level]}`,
      points: earned,
      multiplier: nextMultiplier,
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
