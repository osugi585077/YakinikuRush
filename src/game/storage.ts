const HIGH_SCORE_KEY = "yakiniku-rush:high-score";

export function readHighScore(): number {
  const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function writeHighScore(score: number): void {
  const current = readHighScore();
  if (score > current) {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
  }
}
