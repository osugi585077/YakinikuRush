import { useEffect, useState } from "react";
import { ASSET_PATHS } from "../game/assets";

type StartScreenProps = {
  highScore: number;
  onStart: () => void;
};

type InfoModal = {
  title: string;
  url: string;
  fallback: string;
} | null;

const DESCRIPTION =
  "皿の肉を網で焼こう。最高の焼き加減を見計らってタレ皿へ持って食べよう\n制限時間内にたくさん食べて点数を稼げ！";

const CHANGELOG_URL = `${import.meta.env.BASE_URL}changelog.txt`;
const HOWTO_URL = `${import.meta.env.BASE_URL}howto.txt`;

const SCORE_RULES = [
  {
    className: "perfect",
    label: "最高",
    score: "+50〜2000",
    image: ASSET_PATHS.meat("karubi", 2),
  },
  {
    className: "good",
    label: "生焼け",
    score: "+5〜100",
    image: ASSET_PATHS.meat("karubi", 1),
  },
  {
    className: "raw",
    label: "生",
    score: "0",
    image: ASSET_PATHS.meat("karubi", 0),
  },
  {
    className: "burnt",
    label: "焦げ",
    score: "-50",
    image: ASSET_PATHS.meat("karubi", 3),
  },
] as const;

export function StartScreen({ highScore, onStart }: StartScreenProps) {
  const [modal, setModal] = useState<InfoModal>(null);
  const [modalText, setModalText] = useState("");

  useEffect(() => {
    if (!modal) return;

    setModalText("");
    void fetch(modal.url)
      .then((response) => response.text())
      .then(setModalText)
      .catch(() => setModalText(modal.fallback));
  }, [modal]);

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
      <div className="scoreRules" aria-label="スコアルール">
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
        <div className="titleInfoButtons">
          <button
            className="secondaryButton"
            type="button"
            onClick={() =>
              setModal({
                title: "更新履歴",
                url: CHANGELOG_URL,
                fallback: "- 更新履歴を読み込めませんでした",
              })
            }
          >
            更新履歴
          </button>
          <button
            className="secondaryButton"
            type="button"
            onClick={() =>
              setModal({
                title: "遊び方",
                url: HOWTO_URL,
                fallback: "- 遊び方を読み込めませんでした",
              })
            }
          >
            遊び方
          </button>
        </div>
      </div>
      {modal && (
        <div className="infoOverlay" role="dialog" aria-modal="true">
          <section className="infoPanel" aria-label={modal.title}>
            <h2>{modal.title}</h2>
            <pre>{modalText || "読み込み中..."}</pre>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setModal(null)}
            >
              閉じる
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
