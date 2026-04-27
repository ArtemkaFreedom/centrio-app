<div align="center">
  <img src="assets/logo.png" width="88" height="88" alt="Centrio" />

  # Centrio

  **All your messengers. One window.**

  [![Version](https://img.shields.io/github/v/tag/ArtemkaFreedom/centrio-app?label=version&color=3b82f6&style=flat-square)](https://github.com/ArtemkaFreedom/centrio-app/releases)
  [![Build](https://img.shields.io/github/actions/workflow/status/ArtemkaFreedom/centrio-app/build.yml?style=flat-square&label=build)](https://github.com/ArtemkaFreedom/centrio-app/actions)
  [![Windows](https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white)](https://centrio.me/download)
  [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://centrio.me/download)
  [![Linux](https://img.shields.io/badge/Linux-f97316?style=flat-square&logo=linux&logoColor=white)](https://centrio.me/download)

  [🌐 Website](https://centrio.me) &nbsp;·&nbsp; [📥 Download](https://centrio.me/download) &nbsp;·&nbsp; [💬 Support](mailto:support@centrio.me)
</div>

---

## What is Centrio?

Centrio is a desktop application that brings **100+ messengers and web services into a single window**. Stop switching between browser tabs — Telegram, WhatsApp, Discord, VK, Slack, Notion, Gmail and any other web service live together in one organized workspace.

Built on Electron, Centrio runs natively on **Windows, macOS and Linux** with the same experience across all platforms.

---

## Features

### Core
| | |
|---|---|
| 💬 **100+ services** | Telegram, WhatsApp, Discord, VK, Slack, Notion and any website by URL |
| 🔔 **Smart notifications** | Native system notifications from every service with per-messenger settings |
| 📁 **Folders & grouping** | Organize services into folders: Work, Personal, Projects *(Pro)* |
| ☁️ **Cloud sync** | Settings and messengers sync between all your devices instantly *(Pro)* |
| 🔒 **VPN & proxy** | Built-in SOCKS5/HTTP proxy + full VPN support (VLESS, VMess, Trojan, Shadowsocks, Hysteria2) |
| 🌍 **5 languages** | Russian, English, 中文, Français, Italiano — switch instantly |
| 🎨 **3 themes** | Dark, light and system — one click to switch |
| 🔄 **Auto-update** | Background updates, always the latest version |

### VPN
- Import configs via `vmess://`, `vless://`, `trojan://`, `ss://`, `hy2://` links
- Subscription URL support — import an entire config list at once
- Per-server ping measurement with color indicators (green/yellow/red)
- Country flags, connection timer, one-click connect/disconnect
- Full traffic routing through proxy for all messenger sessions

### Productivity
- Sidebar with drag-and-drop reordering
- Per-messenger mute and Do Not Disturb mode
- Sound control — different notification sounds per service
- PIN lock with configurable auto-lock timeout
- Custom icon per service
- Search across all services
- Keyboard shortcuts (Ctrl+, for settings, and more)

---

## Download

| Platform | Format | Requirements |
|----------|--------|--------------|
| **Windows** | NSIS Installer `.exe` | Windows 10/11 · x64 |
| **macOS** | Disk Image `.dmg` | macOS 12 Monterey+ · x64 |
| **Linux** | AppImage · `.deb` | Ubuntu 20.04+ / Debian / Arch |

👉 **[centrio.me/download](https://centrio.me/download)**

---

## Building from source

### Prerequisites
- Node.js 22+
- npm 10+

### Setup
```bash
git clone https://github.com/ArtemkaFreedom/centrio-app.git
cd centrio-app

npm install

# Copy environment template
cp .env.example .env
# Fill in your OAuth credentials (see .env.example for details)
```

### Run in development
```bash
npm start
# or
npm run dev
```

### Build for production
```bash
# Windows (produces dist/Centrio Setup x.x.x.exe)
npm run build:win

# macOS (produces dist/Centrio-x.x.x.dmg)
npm run build:mac

# Linux (produces dist/Centrio-x.x.x.AppImage + .deb)
npm run build:linux
```

---

## CI/CD Pipeline

Every version tag `v*` triggers an automated multi-platform build via GitHub Actions:

```
git tag v1.x.x && git push origin v1.x.x
        │
        ├─ build-win   (windows-latest) ──► Centrio Setup x.x.x.exe
        ├─ build-mac   (macos-latest)   ──► Centrio-x.x.x.dmg
        └─ build-linux (ubuntu-latest)  ──► Centrio-x.x.x.AppImage
                                             messengerapp_x.x.x_amd64.deb
                │
                └─ deploy ──► upload to download.centrio.me via SCP
```

Required GitHub Secrets:

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Download server IP |
| `SSH_USER` | SSH username |
| `SSH_PASSWORD` | SSH password |
| `GOOGLE_DESKTOP_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_DESKTOP_CLIENT_SECRET` | Google OAuth client secret |
| `YANDEX_CLIENT_ID` | Yandex OAuth client ID |
| `YANDEX_CLIENT_SECRET` | Yandex OAuth client secret |
| `TELEGRAM_BOT_ID` | Telegram Bot ID for notifications |

---

## Architecture

```
centrio-app/
├── main.js                  # Electron main process entry
├── main/
│   ├── bootstrap/           # App init, IPC registration, event handlers
│   ├── factory/             # BrowserWindow & modal window factories
│   ├── ipc/                 # IPC handlers: vpn, proxy, oauth, updater...
│   └── services/            # Core services: store, tracker, updater...
├── renderer/                # Frontend modules (vanilla JS + esbuild)
│   ├── index.js             # Entry point, bootstraps all modules
│   ├── vpn-bind.js          # VPN panel UI & IPC bindings
│   ├── settings-bind.js     # Settings panel
│   └── ...
├── build-renderer.js        # esbuild bundler script
├── preload.js               # Electron contextBridge preload
├── vpn-manager.js           # sing-box VPN process manager
└── .github/workflows/
    └── build.yml            # Multi-platform CI/CD
```

**Main process** handles: window management, IPC, auto-updates, VPN subprocess (sing-box), OAuth flows, system tray, proxy settings, cloud sync.

**Renderer** is vanilla JS bundled by esbuild — no framework overhead, fast startup.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Electron 36](https://electronjs.org) |
| Bundler | [esbuild](https://esbuild.github.io) |
| Packaging | [electron-builder 25](https://electron.build) |
| State persistence | [electron-store 10](https://github.com/sindresorhus/electron-store) |
| Auto-update | [electron-updater](https://www.electron.build/auto-update) |
| VPN engine | [sing-box](https://sing-box.sagernet.org) |
| Auth | Google OAuth 2.0 · Yandex OAuth |
| Payments | YooKassa (Russian cards + international) |

---

## Changelog

See [Centrio — История версий](https://github.com/ArtemkaFreedom/centrio-app/blob/main/CHANGELOG.md) for full release history.

### v1.5.18 — April 2026
- **macOS & Linux builds** — full cross-platform CI/CD via GitHub Actions
- **Language switching** — instant via `location.reload()`, no dependency on tracker/relaunch
- **VPN panel** — import link moved to Settings → Network → VPN; panel shows only config list
- **VPN disconnect** — added `taskkill /f /t` on Windows to kill sing-box and child processes
- **VPN startup** — fixed 10s delay using `log.level:'info'` + port 7890 polling every 300ms

### v1.5.10
- VLESS+Reality+TCP and VLESS+Reality+XHTTP support
- Subscription URL support (import entire config list at once)
- 40 messengers (added WeChat, Zoom, Signal, LINE, Figma, Jira, and more)

### v1.5.9
- VPN: base support for VMess, VLESS, Trojan, Shadowsocks, Hysteria2
- Auto-renewal via YooKassa

---

## License

MIT © 2026 [Centrio](https://centrio.me)
