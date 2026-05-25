import { formatTime } from "../game/rules";

type GameHudProps = {
  score: number;
  highScore: number;
  combo: number;
  multiplier: number;
  timeLeftMs: number;
};

export function GameHud({
  score,
  highScore,
  combo,
  multiplier,
  timeLeftMs,
}: GameHudProps) {
  return (
    <header className="hud" aria-label="ゲーム情報">
      <div className="hudPanel timerPanel">
        <span className="hudLabel">TIME</span>
        <strong className="timerText">{formatTime(timeLeftMs)}</strong>
      </div>
      <div className="hudPanel scorePanel">
        <span className="hudLabel">SCORE</span>
        <strong>{score.toLocaleString()}</strong>
        <small>BEST {highScore.toLocaleString()}</small>
      </div>
      <div className="hudPanel comboPanel">
        <span className="hudLabel">COMBO</span>
        <strong>{combo}</strong>
        <small>x{multiplier.toFixed(2)}</small>
      </div>
    </header>
  );
}
