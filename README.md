# TikTok for LG webOS TV

<p align="center">
  <img src="assets/preview-banner.png" alt="TikTok for LG webOS TV Banner" width="100%" />
</p>

<p align="center">
  <img src="assets/largeIcon.png" alt="TikTok Icon" width="96" />
</p>

A phone-style **LG webOS** `.ipk` application (`com.dorp.tiktok.tv`) built for 1080p LG Smart TVs. Instead of redirecting to the desktop website, it renders an authentic **9:16 vertical mobile TikTok UI** centered on the TV screen with a bundled **webOS Node.js Service** (`com.dorp.tiktok.tv.service`) that fetches the `For You` video feed directly.

## Features

- **Phone-Style 9:16 TV Stage**: Centered vertical video feed (`608×1080`) with an ambient blurred backdrop derived from the active video cover.
- **Smooth Swipe Transitions**: Press `▲` / `▼` (or use the Magic Remote scroll wheel) to smoothly slide between videos with automatic background pre-fetching.
- **Mobile Action Rail & Metadata**: Creator avatar, interactive Like (`♥`) and Bookmark (`🔖`) toggles, comment/share counts, spinning music disc, caption, sound ticker, and playback progress bar.
- **Bundled webOS JS Service (`service/`)**: Runs on-device via Luna Bus (`luna://com.dorp.tiktok.tv.service/getFeed`) to fetch TikTok feed items without CORS limitations.
- **TV Remote Controls**:
  - `▲` / `▼` or Scroll Wheel: Next / Previous video
  - `OK` / `Enter` / `Play` / `Pause`: Play / Pause
  - `◀` / `▶`: Toggle Like
  - `BACK` / `Stop`: Exit app

## Project Structure

```text
tiktok-webos-tv/
├── app/
│   ├── appinfo.json          # webOS app manifest (com.dorp.tiktok.tv)
│   ├── index.html            # 9:16 phone-style feed UI & overlays
│   ├── style.css             # Dark-mode 1080p TV & mobile-feed styling
│   ├── app.js                # Luna service client, video feed & remote controls
│   ├── icon.png              # 80x80 webOS launcher icon
│   ├── largeIcon.png         # 130x130 webOS large launcher icon
│   └── splashBackground.png  # 1920x1080 dark splash screen
├── service/
│   ├── package.json          # webOS JS service manifest
│   ├── services.json         # Luna service registration (com.dorp.tiktok.tv.service)
│   └── service.js            # Node.js TikTok feed fetcher
├── assets/                   # Branding & README banner assets
└── dist/                     # Packaged .ipk releases
```

## Build & Install

### Prerequisites

- [Node.js](https://nodejs.org/)
- [`@webos-tools/cli`](https://www.npmjs.com/package/@webos-tools/cli):
  ```bash
  npm install -g @webos-tools/cli
  ```
- LG TV with **Developer Mode** enabled and configured via `ares-setup-device`.

### Package to `.ipk`

```bash
ares-package app service -o dist
```

This outputs `dist/com.dorp.tiktok.tv_1.1.0_all.ipk`.

### Deploy & Launch on LG TV

```bash
# Verify your configured TV device name
ares-setup-device --list

# Install the IPK (replace 'tv' with your device name)
ares-install -d tv dist/com.dorp.tiktok.tv_1.1.0_all.ipk

# Launch TikTok on the TV
ares-launch -d tv com.dorp.tiktok.tv
```
