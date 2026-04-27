# Centrio

<div align="center">
  <img src="assets/logo.png" width="96" height="96" alt="Centrio logo" />
  
  **Все мессенджеры. Одно окно.**
  
  [![Release](https://img.shields.io/github/v/tag/ArtemkaFreedom/centrio-app?label=версия&color=3b82f6)](https://github.com/ArtemkaFreedom/centrio-app/releases)
  [![Build](https://img.shields.io/github/actions/workflow/status/ArtemkaFreedom/centrio-app/build.yml?label=сборка)](https://github.com/ArtemkaFreedom/centrio-app/actions)
  [![Platform](https://img.shields.io/badge/платформы-Windows%20·%20macOS%20·%20Linux-0078D4)](https://centrio.me/download)
  [![License](https://img.shields.io/badge/лицензия-MIT-green)](LICENSE)

  [🌐 Сайт](https://centrio.me) · [📥 Скачать](https://centrio.me/download) · [💬 Поддержка](mailto:support@centrio.me)
</div>

---

## Что такое Centrio?

Centrio — десктопное приложение, которое объединяет **100+ мессенджеров и веб-сервисов** в одном окне. Telegram, WhatsApp, Discord, ВКонтакте, Slack, Notion, Gmail — всё в одном месте без переключения между вкладками браузера.

Работает на Windows, macOS и Linux.

---

## Возможности

| | |
|---|---|
| 💬 **100+ сервисов** | Telegram, WhatsApp, Discord, VK, Slack, Notion и любой сайт по URL |
| 🔔 **Умные уведомления** | Нативные уведомления от каждого сервиса с гибкой настройкой |
| 📁 **Папки** | Группировка по категориям: Работа, Личное, Проекты *(Pro)* |
| ☁️ **Облачная синхронизация** | Настройки и мессенджеры синхронизируются между устройствами *(Pro)* |
| 🔒 **VPN & прокси** | Встроенная поддержка SOCKS5, HTTP-прокси и VPN конфигов |
| 🎨 **Темы** | Тёмная, светлая и системная тема — переключение в один клик |
| 🔄 **Автообновление** | Приложение обновляется в фоне — всегда актуальная версия |
| 🌍 **5 языков** | Русский, English, 中文, Français, Italiano |

---

## Установка

### Windows
Скачай установщик `.exe` со [страницы загрузки](https://centrio.me/download) и запусти.

### macOS
Скачай `.dmg`, открой, перетащи Centrio в `Applications`.  
> ⚠️ Так как приложение не подписано Apple-сертификатом, при первом запуске: **ПКМ → Открыть → Открыть**

### Linux
```bash
# AppImage
chmod +x Centrio-*.AppImage
./Centrio-*.AppImage

# Или установи .deb
sudo dpkg -i centrio_*.deb
```

---

## Сборка из исходников

```bash
git clone https://github.com/ArtemkaFreedom/centrio-app.git
cd centrio-app
npm install

# Скопируй .env.example в .env и заполни ключи
cp .env.example .env

# Запустить в dev-режиме
npm start

# Собрать под Windows
npm run build:win

# Собрать под macOS
npm run build:mac

# Собрать под Linux
npm run build:linux
```

---

## CI/CD

Каждый тег `v*` автоматически запускает сборку на трёх платформах через GitHub Actions:

```
push tag v1.x.x
    │
    ├── build-win  (windows-latest) → Centrio Setup x.x.x.exe
    ├── build-mac  (macos-latest)   → Centrio-x.x.x.dmg
    └── build-linux (ubuntu-latest) → Centrio-x.x.x.AppImage + .deb
         │
         └── deploy → upload to download.centrio.me
```

---

## Стек

- **[Electron](https://electronjs.org)** — десктопный фреймворк
- **[esbuild](https://esbuild.github.io)** — сборка рендерера
- **[electron-builder](https://electron.build)** — паковка и дистрибуция
- **[electron-store](https://github.com/sindresorhus/electron-store)** — хранение настроек
- **[electron-updater](https://www.electron.build/auto-update)** — автообновление
- **[sing-box](https://sing-box.sagernet.org)** — VPN ядро

---

## Лицензия

MIT © 2026 [Centrio](https://centrio.me)
