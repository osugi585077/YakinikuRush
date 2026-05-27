import { useEffect, useState } from "react";
import { ASSET_PATHS } from "../game/assets";

type StartScreenProps = {
  highScore: number;
  onStart: () => void;
};

const DESCRIPTION =
  "\u76bf\u306e\u8089\u3092\u7db2\u3067\u713c\u3053\u3046\u3002\u6700\u9ad8\u306e\u713c\u304d\u52a0\u6e1b\u3092\u898b\u8a08\u3089\u3063\u3066\u30bf\u30ec\u76bf\u3078\u6301\u3063\u3066\u98df\u3079\u3088\u3046\n\u5236\u9650\u6642\u9593\u5185\u306b\u305f\u304f\u3055\u3093\u98df\u3079\u3066\u70b9\u6570\u3092\u7a3c\u3052\uff01";
const CHANGELOG_URL = `${import.meta.env.BASE_URL}changelog.txt`;

const SCORE_RULES = [
  {
    className: "perfect",
    label: "\u6700\u9ad8",
    score: "+50\u301c2000",
    image: ASSET_PATHS.meat("karubi", 2),
  },
  {
    className: "good",
    label: "\u751f\u713c\u3051",
    score: "+5\u301c100",
    image: ASSET_PATHS.meat("karubi", 1),
  },
  {
    className: "raw",
    label: "\u751f",
    score: "0",
    image: ASSET_PATHS.meat("karubi", 0),
  },
  {
    className: "burnt",
    label: "\u7126\u3052",
    score: "-50",
    image: ASSET_PATHS.meat("karubi", 3),
  },
] as const;

export function StartScreen({ highScore, onStart }: StartScreenProps) {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [changelog, setChangelog] = useState("");

  useEffect(() => {
    if (!isChangelogOpen || changelog) return;

    void fetch(CHANGELOG_URL)
      .then((response) => response.text())
      .then(setChangelog)
      .catch(() => setChangelog("- 更新履歴を読み込めませんでした"));
  }, [changelog, isChangelogOpen]);

  return (
    <main className="screen startScreen">
      <div className="titleStack">
        <span className="versionBadge">ver:1.0</span>
        <span className="kicker">60 SECOND GRILL BATTLE</span>
        <img
          className="titleLogo"
          src={ASSET_PATHS.logo}
          alt="YAKINIKU RUSH"
          draggable={false}
        />
        <p className="startDescription">{DESCRIPTION}</p>
      </div>
      <div className="scoreRules" aria-label="\u30b9\u30b3\u30a2\u30eb\u30fc\u30eb">
        {SCORE_RULES.map((rule) => (
          <div className={`rule scoreRule ${rule.className}`} key={rule.label}>
            <img
              className="scoreRuleImage"
              src={rule.image}
              alt=""
              draggable={false}
              aria-hidden="true"
            />
            <span>{rule.label}</span>
            <strong>{rule.score}</strong>
          </div>
        ))}
      </div>
      <div className="startActions">
        <span>BEST {highScore.toLocaleString()}</span>
        <button className="primaryButton" type="button" onClick={onStart}>
          START
        </button>
        <button
          className="secondaryButton"
          type="button"
          onClick={() => setIsChangelogOpen(true)}
        >
          更新履歴
        </button>
      </div>
      {isChangelogOpen && (
        <div className="changelogOverlay" role="dialog" aria-modal="true">
          <section className="changelogPanel" aria-label="更新履歴">
            <h2>更新履歴</h2>
            <pre>{changelog || "読み込み中..."}</pre>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setIsChangelogOpen(false)}
            >
              閉じる
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
