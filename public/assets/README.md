# YAKINIKU RUSH Asset Guide

このフォルダは、後から画像素材や効果音を差し替えるための置き場所です。
Viteでは `public` 配下のファイルを、アプリ内から `/assets/...` のように参照できます。

## 焼き網画像

保存先:

`public/assets/images/grill/`

推奨サイズ:

- 基本: `1024 x 1024px`
- 余裕を持つ場合: `1536 x 1536px`
- 形式: `png` または `webp`
- 透過: あり推奨
- 比率: 正方形推奨

現在の網エリアはほぼ正方形で表示されます。画像は中央に網が入り、外周に少し余白があるとスマホでも切れにくいです。

現在の実装で使うアニメーション用ファイル名:

- `ami_01.png`
- `ami_02.png`
- `ami_03.png`
- `ami_04.png`
- `ami_05.png`
- `ami_06.png`

この6枚を約0.12秒ごとに切り替えてループします。

## 肉画像

保存先:

`public/assets/images/meat/`

推奨サイズ:

- 1枚あたり: `512 x 384px`
- 高解像度で用意する場合: `768 x 576px`
- 形式: `png` または `webp`
- 透過: あり推奨
- 比率: `4:3` くらいの横長推奨

必要枚数:

肉種4種類 x 焼き具合4段階 = 合計16枚

焼き具合:

- `0`: 生
- `1`: 生焼け
- `2`: 最高の焼き具合
- `3`: 焦げ

推奨ファイル名:

- `tan-0.png`
- `tan-1.png`
- `tan-2.png`
- `tan-3.png`
- `karubi-0.png`
- `karubi-1.png`
- `karubi-2.png`
- `karubi-3.png`
- `harami-0.png`
- `harami-1.png`
- `harami-2.png`
- `harami-3.png`
- `horumon-0.png`
- `horumon-1.png`
- `horumon-2.png`
- `horumon-3.png`

## 音声ファイル

保存先:

`public/assets/audio/`

推奨形式:

- `mp3`: 互換性重視
- `wav`: 短い効果音で高音質にしたい場合
- `ogg`: 軽量化したい場合の追加候補

推奨ファイル:

- `start.mp3`: STARTを押したときの音
- `kettei.mp3`: ボタンを押したときの音
- `place.mp3`: 肉を網に置く
- `niku_yaku01.mp3`: 焼き肉を焼いているときの音
- `niku_yaku02.mp3`: 焼き肉を焼いているときの音
- `pickup.mp3`: タレ皿へ入れた音
- `best-score.mp3`: ベスト更新
- `end.mp3`: 制限時間が経過したときの音
- `result-bang.mp3`: 結果表示の「ダン！」

音量の目安:

- 効果音: 0.4〜0.7秒程度
- 焼ける音: 1〜3秒程度のループ素材
- BGMを入れる場合: `public/assets/audio/bgm/` を作ると整理しやすいです。
