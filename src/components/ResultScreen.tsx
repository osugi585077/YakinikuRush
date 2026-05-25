import { useEffect, useState } from "react";
import { ASSET_PATHS } from "../game/assets";

type ResultScreenProps = {
  score: number;
  highScore: number;
  bestCombo: number;
  isNewRecord: boolean;
  seVolume: number;
  onRestart: () => void;
  onTitle: () => void;
};

const RESULT_LABEL = "\u30ea\u30b6\u30eb\u30c8";
const RETRY_TEXT = "\u3082\u3046\u4e00\u5ea6\u884c\u304f";
const TITLE_TEXT = "\u30bf\u30a4\u30c8\u30eb\u306b\u623b\u308b";

function getRank(score: number) {
  if (score >= 5000) return "S";
  if (score >= 3000) return "A";
  if (score >= 1500) return "B";
  return "C";
}

export function ResultScreen({
  score,
  highScore,
  bestCombo,
  isNewRecord,
  seVolume,
  onRestart,
  onTitle,
}: ResultScreenProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const scoreAudio = new Audio(ASSET_PATHS.audio.scoreCount);
    scoreAudio.volume = seVolume;
    scoreAudio.loop = true;
    void scoreAudio.play().catch(() => {});

    const duration = 1200;
    const startedAt = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(score * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      scoreAudio.pause();
      scoreAudio.currentTime = 0;
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      scoreAudio.pause();
      scoreAudio.currentTime = 0;
    };
  }, [score, seVolume]);

  return (
    <main className="screen resultScreen">
      <div className="titleStack resultTitleStack">
        <span className="kicker">{isNewRecord ? "NEW RECORD" : "RESULT"}</span>
        <img
          className="resultEndImage"
          src={ASSET_PATHS.resultEnd}
          alt="\u3054\u3061\u305d\u3046\u3055\u307e\u3067\u3057\u305f\uff01"
          draggable={false}
        />
        <p>BEST {highScore.toLocaleString()}</p>
      </div>
      <div className="resultStats resultBang" aria-label={RESULT_LABEL}>
        <div className="resultItem resultScore">
          <span>SCORE</span>
          <strong>{displayScore.toLocaleString()}</strong>
        </div>
        <div className="resultItem resultCombo">
          <span>MAX COMBO</span>
          <strong>{bestCombo}</strong>
        </div>
        <div className="resultItem resultRank">
          <span>RANK</span>
          <strong>{getRank(score)}</strong>
        </div>
      </div>
      <div className="resultActions">
        <button className="primaryButton" type="button" onClick={onRestart}>
          {RETRY_TEXT}
        </button>
        <button className="secondaryButton" type="button" onClick={onTitle}>
          {TITLE_TEXT}
        </button>
      </div>
    </main>
  );
}
