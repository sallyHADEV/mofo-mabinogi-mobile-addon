<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="128" alt="MoFoアイコン">

# MoFo

**マビノギモバイル向け情報オーバーレイ（HUD）**

<sub><b>Mo</b>bi + In<b>Fo</b> — ゲーム画面はそのまま、必要な情報だけを上に重ねて表示します。</sub>

<br>

![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6?logo=windows&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

[한국어](README.md) · [English](README.en.md) · **日本語** · [繁體中文](README.zh-TW.md)

### [⬇ mofo.exe をダウンロード](https://github.com/sallyHADEV/mofo-mabinogi-mobile-addon/releases/latest/download/mofo.exe)

<sub>[Releases](https://github.com/sallyHADEV/mofo-mabinogi-mobile-addon/releases/latest) · Windows 10 / 11</sub>

</div>

---

## 🎬 紹介動画

<div align="center">
  <img src="docs/images/mofo-intro.webp" width="800" alt="MoFo紹介動画">
  <br>
  <a href="docs/media/mofo-intro.mp4"><b>▶ 音声付きのフル動画を見る (mp4)</b></a>
</div>

> ※ アプリのUIと動画は韓国語です。

---

## ✨ 機能

### 🕰️ エリン時間
ゲーム内のエリン時間・天気・現在地を、小さなバッジでいつでも確認できます。

<img src="docs/images/03-clock-badge-move-mode.png" width="420" alt="エリン時計バッジ">

### ⚒️ 製作状況
6つの加工施設（金属・木材・皮革・布・薬・料理）の残り時間をリアルタイムでカウントダウン表示します。完成したものは金色に光り、**ワンクリックで回収**できます。2段表示と1段表示から選べます。

<img src="docs/images/17-altering-hud-2row.png" width="420" alt="製作状況HUD">

### 📋 残りミッション
未完了のデイリー・ウィークリーミッションだけを表示します。

<img src="docs/images/21-missions-tab-daily.png" width="240" alt="残りミッション">

### 🎵 メディアリモコン
Spotify、YouTube Music、Chrome、Edgeなど、PCで再生中の音楽を、ゲームを離れずに操作できます。再生 / 一時停止 / 前の曲 / 次の曲 / 音量に対応しています。

<img src="docs/images/24-media-remote-playing.png" width="360" alt="メディアリモコン">

### 🎻 コンサート放送モーション
近くで合奏が始まると、MoFoが同じ楽譜を演奏している人たちを数秒間まとめ、放送のテロップのように**一度だけ**表示します。テーマは4種類から選べます。

<img src="docs/images/41-theme-cinematic-crop.png" width="640" alt="コンサート放送モーション">

<details>
<summary>4つのテーマをすべて見る</summary>

| **シネマティック・ゴールド** | **ヴァインブルーム** |
|:---:|:---:|
| <img src="docs/images/41-theme-cinematic-crop.png" width="380"> | <img src="docs/images/42-theme-vinebloom-crop.png" width="380"> |
| **アーケイン・ルーン** | **オーロラ・プリズム** |
| <img src="docs/images/43-theme-arcanerune-crop.png" width="380"> | <img src="docs/images/44-theme-auroraprism-crop.png" width="380"> |

</details>

### 🔎 原曲検索 <sup>NEW</sup>
楽譜を選んで演奏すると、MoFoが楽譜のタイトルから `[합주용]` や `#피아노` といったタグを取り除き、原曲を探します。一致が確実な場合に限り、**結果をチャットに自動で投稿**します。
FLO・iTunes・Deezerの公開検索を利用するため、**APIキーは不要で無料**です。
設定 → **원곡 찾기（原曲検索）ON** でオンにしてください。

### 🖱️ ゲームの邪魔をしません
- **スマートパススルー**: ウィジェット上だけクリックを受け付け、何もない場所のクリックはそのままゲームに届きます。
- **完全パススルー (F8)**: ウィジェットを含め、すべてのクリックがゲームに届きます。
- **ウィジェットをダブルクリックすると5秒間非表示**になります。ウィジェットの移動・固定・位置のリセットも可能です。
- ゲームウィンドウを最小化するとオーバーレイも一緒に隠れ、元に戻すとオーバーレイも再び表示されます。
- システムトレイのアイコンから表示 / 非表示を切り替えられます。

### ⚙️ 設定
3種類のレイアウトプリセット（リアルタイムで保存）、UIスケール75〜200%、ウィジェットごとのオン / オフ、合奏の集計待ち時間、テロップの表示時間などを設定できます。

<img src="docs/images/11b-settings-modal-crop.png" width="640" alt="設定画面">

---

## 🚀 はじめに

### 動作環境
- Windows 10 / 11 (WebView2ランタイム)
- **マビノギモバイル PCクライアント** — MoFoは、ゲームに同梱されている `MabinogiMobile_CLI.exe` を通じてゲーム情報を読み取ります。実行中のゲームのフォルダから自動的に見つけますが、見つからない場合は環境変数 `MABINOGI_CLI_PATH` を設定してください。
- ビルドする場合: [Node.js](https://nodejs.org/) 18以上、[Rust](https://www.rust-lang.org/tools/install)

### ビルドと実行

```bash
npm install
npm run tauri:dev     # run in development mode
npm run tauri:build   # build the executable → src-tauri/target/release/mofo.exe
```

透明でフレームのない最前面ウィンドウが、ゲームの上に重なって表示されます。

### OBSでの録画
キャプチャ保護は行っていないため、ディスプレイキャプチャ（OBS、GeForce Experienceなど）ではオーバーレイもそのまま録画されます。

<details>
<summary>Webオーバーレイモード（OBSブラウザソース）</summary>

`npm run dev` を実行し、`http://localhost:3002` をOBSのブラウザソース（1920×1080）として追加すると、透明なレイヤーとして合成できます。
このモードには、ポート3001で動作する別個のMabinogi Bridgeサーバーが必要です。これはこのリポジトリには含まれていません。

</details>

---

## 🧱 技術スタック

| 分野 | 使用技術 |
|---|---|
| アプリシェル | Tauri 2 (Rust) — 透明ウィンドウ、クリックスルー、トレイ、ゲームウィンドウの追跡 |
| UI | React 19 · TypeScript · Vite · Framer Motion |
| メディア制御 | Windows Media Session API · システム音量 |
| 楽曲検索 | FLO · iTunes · Deezerの公開検索 |

---

## ⚠️ 免責事項

MoFoは非公式のファンメイドツールであり、NEXONおよびマビノギモバイルとは一切関係ありません。
ゲーム名および商標は、それぞれの権利者に帰属します。

## 📄 ライセンス

[MIT](LICENSE)
