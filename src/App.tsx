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

type AudioEngine = {
  bgmVolume: number;
  seVolume: number;
  unlocked: boolean;
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
  cooking: HTMLAudioElement | null;
};

const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_SE_VOLUME = 0.5;

function createAudio(src: string, volume: number) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = volume;
  return audio;
}

function getAudioEngine(ref: MutableRefObject<AudioEngine | null>) {
  if (!ref.current) {
    ref.current = {
      bgmVolume: DEFAULT_BGM_VOLUME,
      seVolume: DEFAULT_SE_VOLUME,
      unlocked: false,
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
      cooking: null,
    };
    ref.current.title.loop = true;
    ref.current.wait.loop = true;
  }

  return ref.current;
}

function applyAudioVolumes(engine: AudioEngine) {
  engine.title.volume = engine.bgmVolume * 0.7;
  engine.wait.volume = engine.bgmVolume;
  engine.result.volume = engine.bgmVolume * 0.95;
  if (engine.cooking) {
    engine.cooking.volume = engine.bgmVolume * 0.65;
  }

  engine.countdown.volume = engine.seVolume;
  engine.start.volume = engine.seVolume * 0.96;
  engine.kettei.volume = engine.seVolume * 0.85;
  engine.finish.volume = engine.seVolume * 0.96;
  engine.eatOk.volume = engine.seVolume * 0.96;
  engine.eatNo.volume = engine.seVolume * 0.96;
  engine.eatVege.volume = engine.seVolume;
  engine.drink.volume = engine.seVolume * 0.95;
  engine.scoreCount.volume = engine.seVolume;
}

function playOneShot(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function getUnlockableAudio(engine: AudioEngine) {
  return [
    engine.countdown,
    engine.start,
    engine.kettei,
    engine.finish,
    engine.eatOk,
    engine.eatNo,
    engine.eatVege,
    engine.drink,
    engine.scoreCount,
  ];
}

function unlockAudio(engine: AudioEngine) {
  if (engine.unlocked) return;
  engine.unlocked = true;

  getUnlockableAudio(engine).forEach((audio) => {
    const wasMuted = audio.muted;
    audio.muted = true;
    audio.currentTime = 0;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {})
      .finally(() => {
        audio.muted = wasMuted;
      });
  });
}

function stopCookingSound(engine: AudioEngine) {
  if (!engine.cooking) return;

  engine.cooking.onended = null;
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
  engine.title.currentTime = 0;
  void engine.title.play().catch(() => {});
}

function stopTitleSound(engine: AudioEngine) {
  engine.title.pause();
  engine.title.currentTime = 0;
}

function playRandomCookingSound(engine: AudioEngine) {
  const source =
    ASSET_PATHS.audio.sizzle[
      Math.floor(Math.random() * ASSET_PATHS.audio.sizzle.length)
    ];
  const audio = createAudio(source, engine.bgmVolume * 0.65);
  engine.cooking = audio;
  audio.onended = () => {
    if (engine.cooking === audio) {
      playRandomCookingSound(engine);
    }
  };
  void audio.play().catch(() => {});
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
  const [pointPopup, setPointPopup] = useState<{
    id: number;
    points: number;
  } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cutInLevel, setCutInLevel] = useState<CookLevel | null>(null);
  const [highScore, setHighScore] = useState(() => readHighScore());
  const [lastRunWasRecord, setLastRunWasRecord] = useState(false);
  const [bestNoticeVisible, setBestNoticeVisible] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(DEFAULT_BGM_VOLUME);
  const [seVolume, setSeVolume] = useState(DEFAULT_SE_VOLUME);
  const nextMeatId = useRef(1);
  const lastTick = useRef<number | null>(null);
  const grillRef = useRef<HTMLDivElement | null>(null);
  const sauceRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const cutInTimerRef = useRef<number | null>(null);
  const pointPopupTimerRef = useRef<number | null>(null);
  const countdownSoundNumberRef = useRef<number | null>(null);

  const multiplier = useMemo(() => getMultiplier(combo), [combo]);

  useEffect(() => {
    const unlockTitleAudio = () => {
      if (phase !== "ready") return;
      const engine = getAudioEngine(audioRef);
      unlockAudio(engine);
      startTitleSound(engine);
    };

    window.addEventListener("pointerdown", unlockTitleAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockTitleAudio);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") return;

    const engine = getAudioEngine(audioRef);
    countdownSoundNumberRef.current = null;
    const startedAt = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const remaining = Math.max(0, COUNTDOWN_DURATION_MS - (now - startedAt));
      const currentNumber = Math.max(1, Math.ceil(remaining / 1000));
      setCountdownMs(remaining);

      if (remaining === 0) {
        playOneShot(engine.finish);
        lastTick.current = null;
        setPhase("playing");
        return;
      }

      if (countdownSoundNumberRef.current !== currentNumber) {
        countdownSoundNumberRef.current = currentNumber;
        playOneShot(engine.countdown);
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;

    let frameId = 0;

    const tick = (now: number) => {
      const previous = lastTick.current ?? now;
      const delta = now - previous;
      lastTick.current = now;

      setTimeLeftMs((current) => {
        const next = Math.max(0, current - delta);
        if (next === 0) {
          setPhase("ending");
        }
        return next;
      });

      setMeats((current) =>
        current.map((meat) => ({
          ...meat,
          ageMs: meat.ageMs + delta,
        })),
      );

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      lastTick.current = null;
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
      startTitleSound(getAudioEngine(audioRef));
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

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: globalThis.PointerEvent) => {
      setDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
            }
          : null,
      );
    };

    const handleUp = (event: globalThis.PointerEvent) => {
      finishDrag(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    window.addEventListener("pointercancel", handleUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [drag, meats]);

  useEffect(() => {
    return () => {
      if (cutInTimerRef.current !== null) {
        window.clearTimeout(cutInTimerRef.current);
      }
      if (pointPopupTimerRef.current !== null) {
        window.clearTimeout(pointPopupTimerRef.current);
      }
    };
  }, []);

  function startGame(playStartSound = true) {
    const engine = getAudioEngine(audioRef);
    unlockAudio(engine);
    stopCookingSound(engine);
    stopWaitSound(engine);
    stopTitleSound(engine);
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
    setCutInLevel(null);
    setPointPopup(null);
    setTimeLeftMs(GAME_DURATION_MS);
    setCountdownMs(COUNTDOWN_DURATION_MS);
    setLastRunWasRecord(false);
    setBestNoticeVisible(false);
    setDrag(null);
    nextMeatId.current = 1;
    lastTick.current = null;
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
    setPhase("ready");
    setMeats([]);
    setCombo(0);
    setPerfectCombo(0);
    setScoreEvent(null);
    setPointPopup(null);
    setCutInLevel(null);
    setDrag(null);
    setTimeLeftMs(GAME_DURATION_MS);
    setCountdownMs(COUNTDOWN_DURATION_MS);
    lastTick.current = null;
  }

  function beginPlateDrag(
    plate: PlateMeat,
    event: PointerEvent<HTMLElement>,
  ) {
    if (phase !== "playing") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      source: { type: "plate", plateId: plate.plateId, kind: plate.kind },
      x: event.clientX,
      y: event.clientY,
    });
  }

  function beginGrillDrag(id: number, event: PointerEvent<HTMLElement>) {
    if (phase !== "playing") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      source: { type: "grill", id },
      x: event.clientX,
      y: event.clientY,
    });
  }

  function finishDrag(x: number, y: number) {
    if (!drag || phase !== "playing") {
      setDrag(null);
      return;
    }

    const source = drag.source;

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
    const meat = meats.find((item) => item.id === id);
    if (!meat) return;

    const level = getCookLevel(meat.kind, meat.ageMs);
    const baseScore = getScore(meat.kind, level);
    const nextCombo = isComboLevel(level) && baseScore > 0 ? combo + 1 : 0;
    const nextMultiplier = getMultiplier(nextCombo);
    const earned = Math.round(baseScore * nextMultiplier);
    const engine = getAudioEngine(audioRef);
    playOneShot(isComboLevel(level) ? engine.eatOk : engine.eatNo);

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
    showCutIn(level);
    showPointPopup(earned);
  }

  function showCutIn(level: CookLevel) {
    if (cutInTimerRef.current !== null) {
      window.clearTimeout(cutInTimerRef.current);
    }

    setCutInLevel(null);
    window.requestAnimationFrame(() => {
      setCutInLevel(level);
    });

    cutInTimerRef.current = window.setTimeout(() => {
      setCutInLevel(null);
      cutInTimerRef.current = null;
    }, 1100);
  }

  function showPointPopup(points: number) {
    if (pointPopupTimerRef.current !== null) {
      window.clearTimeout(pointPopupTimerRef.current);
    }

    setPointPopup({
      id: Date.now(),
      points,
    });

    pointPopupTimerRef.current = window.setTimeout(() => {
      setPointPopup(null);
      pointPopupTimerRef.current = null;
    }, 1000);
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
  const shouldShowPerfectCombo = perfectCombo >= 2;

  return (
    <main className="gameShell">
      {bestNoticeVisible && (
        <div className="bestScoreToast" role="status">
          {BEST_SCORE_TEXT}
        </div>
      )}
      {cutInLevel !== null && (
        <div className="cutIn" aria-hidden="true">
          <img
            src={ASSET_PATHS.cutIn[cutInLevel]}
            alt=""
            draggable={false}
          />
        </div>
      )}
      {pointPopup && (
        <div className="pointPopup" key={pointPopup.id} aria-live="polite">
          {pointPopup.points > 0 ? "+" : ""}
          {pointPopup.points}
        </div>
      )}
      {shouldShowPerfectCombo && (
        <div className="perfectComboBanner" aria-live="polite">
          {perfectCombo} COMBO
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
          <VegetablePlate onEat={() => playOneShot(getAudioEngine(audioRef).eatVege)} />
          <SaucePlate sauceRef={sauceRef} />
          <BeerMug onDrink={() => playOneShot(getAudioEngine(audioRef).drink)} />
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
