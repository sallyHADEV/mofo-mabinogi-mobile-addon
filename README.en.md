<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="128" alt="MoFo icon">

# MoFo

**An info overlay (HUD) for Mabinogi Mobile**

<sub><b>Mo</b>bi + In<b>Fo</b> — the game stays as it is; just the info you need, on top.</sub>

<br>

![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6?logo=windows&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

[한국어](README.md) · **English**

</div>

---

## 🎬 Intro video

<div align="center">
  <img src="docs/images/mofo-intro.webp" width="800" alt="MoFo intro video">
  <br>
  <a href="docs/media/mofo-intro.mp4"><b>▶ Watch the full video with sound (mp4)</b></a>
</div>

---

## ✨ Features

### 🕰️ Erinn Time
A small badge that always shows the in-game Erinn time, weather and your current location.

<img src="docs/images/03-clock-badge-move-mode.png" width="420" alt="Erinn clock badge">

### ⚒️ Crafting Status
Live countdowns for all six processing facilities (metal, wood, leather, cloth, medicine, food). Finished ones glow gold and can be **collected with one click**. Choose a two-row or one-row layout.

<img src="docs/images/17-altering-hud-2row.png" width="420" alt="Crafting status HUD">

### 📋 Remaining Missions
Shows only the daily and weekly missions you haven't finished yet.

<img src="docs/images/21-missions-tab-daily.png" width="240" alt="Remaining missions">

### 🎵 Media Remote
Control music playing on your PC — Spotify, YouTube Music, Chrome, Edge and more — without leaving the game. Play / pause / previous / next / volume.

<img src="docs/images/24-media-remote-playing.png" width="360" alt="Media remote">

### 🎻 Concert Broadcast Motion
When an ensemble starts nearby, MoFo gathers everyone playing the same sheet for a few seconds, then shows them **once**, like a broadcast caption. Four themes to choose from.

<img src="docs/images/41-theme-cinematic-crop.png" width="640" alt="Concert broadcast motion">

<details>
<summary>See all four themes</summary>

| **Cinematic Gold** | **Vine Bloom** |
|:---:|:---:|
| <img src="docs/images/41-theme-cinematic-crop.png" width="380"> | <img src="docs/images/42-theme-vinebloom-crop.png" width="380"> |
| **Arcane Rune** | **Aurora Prism** |
| <img src="docs/images/43-theme-arcanerune-crop.png" width="380"> | <img src="docs/images/44-theme-auroraprism-crop.png" width="380"> |

</details>

### 🔎 Song Finder <sup>NEW</sup>
Pick a music sheet and play it — MoFo strips tags like `[합주용]` or `#피아노` from the sheet title and finds the original song. It **posts the result to chat automatically**, but only when the match is certain.
It uses public search from FLO, iTunes and Deezer, so **no API key and no cost.**
Turn it on in Settings → **원곡 찾기 (Song Finder) ON**.

### 🖱️ Stays out of your way
- **Smart pass-through**: only the widgets take clicks; clicks on empty space go straight to the game.
- **Full pass-through (F8)**: every click goes to the game, widgets included.
- **Double-click a widget to hide it for 5 seconds**; move / lock / reset widget positions.
- Minimize the game window and the overlay hides with it; restore it and the overlay comes back.
- Show or hide from the system tray icon.

### ⚙️ Settings
Three layout presets (saved live), UI scale 75–200%, per-widget toggles, ensemble gathering delay, caption duration and more.

<img src="docs/images/11b-settings-modal-crop.png" width="640" alt="Settings window">

---

## 🚀 Getting started

### Requirements
- Windows 10 / 11 (WebView2 runtime)
- **Mabinogi Mobile PC client** — MoFo reads game info through `MabinogiMobile_CLI.exe`, which ships with the game. It is found automatically from the running game's folder; otherwise set the `MABINOGI_CLI_PATH` environment variable.
- To build: [Node.js](https://nodejs.org/) 18+, [Rust](https://www.rust-lang.org/tools/install)

### Build & run

```bash
npm install
npm run tauri:dev     # run in development mode
npm run tauri:build   # build the executable → src-tauri/target/release/mofo.exe
```

A transparent, frameless, always-on-top window sits over the game.

### Recording with OBS
There is no capture protection, so display capture (OBS, GeForce Experience, …) records the overlay as-is.

<details>
<summary>Web overlay mode (OBS browser source)</summary>

Run `npm run dev` and add `http://localhost:3002` as an OBS browser source (1920×1080) to composite it as a transparent layer.
This mode needs a separate Mabinogi Bridge server on port 3001, which is not part of this repository.

</details>

---

## 🧱 Tech stack

| Area | Built with |
|---|---|
| App shell | Tauri 2 (Rust) — transparent window, click-through, tray, game window tracking |
| UI | React 19 · TypeScript · Vite · Framer Motion |
| Media control | Windows Media Session API · system volume |
| Song search | FLO · iTunes · Deezer public search |

---

## ⚠️ Disclaimer

MoFo is an unofficial fan-made tool and is not affiliated with NEXON or Mabinogi Mobile.
Game names and trademarks belong to their respective owners.

## 📄 License

[MIT](LICENSE)
