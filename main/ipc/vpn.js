// VPN IPC-хендлеры
// Управляют подключением через sing-box, загрузкой бинарника, подписками.
// ВАЖНО: не используем wrapIpc — хендлеры сами формируют { success, ... }.
// applyAllSessionsProxy применяет прокси ко всем сессиям мессенджеров (не только defaultSession).

const { ipcMain } = require('electron')
const fs   = require('fs')
const { applyAllSessionsProxy } = require('../services/proxy')
const store = require('../services/store')

// Ленивая загрузка vpn-manager (находится в корне проекта)
let vpnMgr = null
function getVpn () {
    if (!vpnMgr) vpnMgr = require('../../vpn-manager')
    return vpnMgr
}

// Общий обработчик ошибок — возвращает { success: false, error: '...' }
function errResult (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
}

// Прокси-настройки для включения/выключения VPN
function vpnProxyOn  (port) { return { enabled: true, type: 'socks5', host: '127.0.0.1', port } }
function vpnProxyOff ()     { return { enabled: false } }

// Сохраняем ссылку активного конфига — чтобы восстановить после перезапуска
function saveActiveLink (link) { store.set('vpnActiveLink', link || null) }
function loadActiveLink ()     { return store.get('vpnActiveLink', null) }

function registerVpnIpc ({ getMainWindow }) {

    // ── Получить текущий статус (+ авто-восстановление при перезапуске) ──
    ipcMain.handle('vpn-status', async () => {
        try {
            const vpn = getVpn()
            // Если прокси не активен, но есть сохранённая ссылка — пробуем переподключиться
            const st = vpn.getStatus()
            if (!st.active) {
                const link = loadActiveLink()
                if (link) {
                    try {
                        const binPath = vpn.getSingboxPath()
                        if (fs.existsSync(binPath)) {
                            // Тихое восстановление: парсим и запускаем
                            const parsed = link.startsWith('http://') || link.startsWith('https://')
                                ? null  // подписки не восстанавливаем — только одиночные конфиги
                                : vpn.parseVpnLink(link)
                            if (parsed) {
                                await vpn.startProxy(parsed, (line) => {
                                    const win = getMainWindow()
                                    if (win) win.webContents.send('vpn-log', line)
                                })
                                await applyAllSessionsProxy(vpnProxyOn(vpn.PROXY_PORT))
                            }
                        }
                    } catch (e) {
                        // Если не получилось восстановить — сбрасываем сохранённую ссылку
                        console.warn('[VPN] auto-restore failed:', e.message)
                        saveActiveLink(null)
                    }
                }
            }
            return vpn.getStatus()
        } catch (e) {
            return { active: false, port: 7890, name: null, configs: [] }
        }
    })

    // ── Подключить (ссылка или URL подписки) ──────────────────────
    ipcMain.handle('vpn-connect', async (event, link) => {
        try {
            const vpn     = getVpn()
            const binPath = vpn.getSingboxPath()

            // sing-box ещё не скачан — сообщаем рендереру
            if (!fs.existsSync(binPath)) {
                return { success: false, needsDownload: true }
            }

            // Подписка: http(s):// → скачать, распарсить, сохранить все, подключить к первому
            if (link.startsWith('http://') || link.startsWith('https://')) {
                const items = await vpn.fetchSubscription(link)
                if (!items || items.length === 0) {
                    return { success: false, error: 'Конфигурации не найдены в подписке' }
                }
                for (const item of items) vpn.saveConfig(item.parsed.name, item.link)

                await vpn.startProxy(items[0].parsed, (line) => {
                    const win = getMainWindow()
                    if (win) win.webContents.send('vpn-log', line)
                })
                await applyAllSessionsProxy(vpnProxyOn(vpn.PROXY_PORT))
                saveActiveLink(items[0].link)
                return { success: true, status: vpn.getStatus(), imported: items.length }
            }

            // Одиночная VPN-ссылка
            const parsed = vpn.parseVpnLink(link)
            vpn.saveConfig(parsed.name, link)

            await vpn.startProxy(parsed, (line) => {
                const win = getMainWindow()
                if (win) win.webContents.send('vpn-log', line)
            })
            await applyAllSessionsProxy(vpnProxyOn(vpn.PROXY_PORT))
            saveActiveLink(link)
            return { success: true, status: vpn.getStatus() }

        } catch (e) {
            return errResult(e)
        }
    })

    // ── Скачать sing-box и подключить ─────────────────────────────
    ipcMain.handle('vpn-download-and-connect', async (event, link) => {
        try {
            const vpn = getVpn()
            const win = getMainWindow()

            await vpn.downloadSingbox((progress) => {
                if (win) win.webContents.send('vpn-download-progress', progress)
            })

            // Подписка
            if (link.startsWith('http://') || link.startsWith('https://')) {
                const items = await vpn.fetchSubscription(link)
                if (!items || items.length === 0) {
                    return { success: false, error: 'Конфигурации не найдены в подписке' }
                }
                for (const item of items) vpn.saveConfig(item.parsed.name, item.link)

                await vpn.startProxy(items[0].parsed, (line) => {
                    if (win) win.webContents.send('vpn-log', line)
                })
                await applyAllSessionsProxy(vpnProxyOn(vpn.PROXY_PORT))
                saveActiveLink(items[0].link)
                return { success: true, status: vpn.getStatus(), imported: items.length }
            }

            // Одиночная ссылка
            const parsed = vpn.parseVpnLink(link)
            vpn.saveConfig(parsed.name, link)

            await vpn.startProxy(parsed, (line) => {
                if (win) win.webContents.send('vpn-log', line)
            })
            await applyAllSessionsProxy(vpnProxyOn(vpn.PROXY_PORT))
            saveActiveLink(link)
            return { success: true, status: vpn.getStatus() }

        } catch (e) {
            return errResult(e)
        }
    })

    // ── Подключить по сохранённой ссылке (из списка) ──────────────
    ipcMain.handle('vpn-connect-saved', async (event, link) => {
        try {
            const vpn     = getVpn()
            const binPath = vpn.getSingboxPath()
            if (!fs.existsSync(binPath)) return { success: false, needsDownload: true }

            const parsed = vpn.parseVpnLink(link)
            await vpn.startProxy(parsed, (line) => {
                const win = getMainWindow()
                if (win) win.webContents.send('vpn-log', line)
            })
            await applyAllSessionsProxy(vpnProxyOn(vpn.PROXY_PORT))
            saveActiveLink(link)
            return { success: true, status: vpn.getStatus() }
        } catch (e) {
            return errResult(e)
        }
    })

    // ── Отключить VPN ─────────────────────────────────────────────
    ipcMain.handle('vpn-disconnect', async () => {
        try {
            const vpn = getVpn()
            await vpn.stopProxy()
            await applyAllSessionsProxy(vpnProxyOff())
            saveActiveLink(null)
            return { success: true, status: vpn.getStatus() }
        } catch (e) {
            return errResult(e)
        }
    })

    // ── Пинг конфига (TCP-замер до сервера) ──────────────────────
    ipcMain.handle('vpn-ping', async (event, link) => {
        try {
            const ms = await getVpn().pingConfig(link)
            return { success: true, ms }
        } catch (e) {
            return { success: true, ms: null }
        }
    })

    // ── Удалить сохранённый конфиг ────────────────────────────────
    ipcMain.handle('vpn-delete-config', async (event, id) => {
        try {
            const configs = getVpn().deleteConfig(id)
            return { success: true, configs }
        } catch (e) {
            return errResult(e)
        }
    })
}

module.exports = registerVpnIpc
