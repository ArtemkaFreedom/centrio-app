// ==============================
// renderer.js
// Полностью адаптирован под:
// - contextIsolation: true
// - nodeIntegration: false
// - работу через window.electronAPI
// ==============================

// ==============================
// ИМПОРТЫ ВНУТРЕННИХ МОДУЛЕЙ
// ==============================
const state = require('./renderer/state')
const { tGet, applyI18n, initI18n, setCurrentLanguage } = require('./renderer/i18n')
const { getCurrentLocale, getUserInitial, hashPassword } = require('./renderer/helpers')
const { popularMessengers, folderIcons, PAGE_SIZE } = require('./renderer/constants')
const { createCloudStore, createCloudApi } = require('./renderer/cloud')
const { createSoundsApi } = require('./renderer/sounds')
const { bindDownloads } = require('./renderer/downloads')
const { createProxyApi } = require('./renderer/proxy')
const { bindUpdater, showUpdateBanner } = require('./renderer/updater')

const { createStatusBarApi } = require('./renderer/status-bar')
const { createTooltipsApi } = require('./renderer/tooltips')
const { createUnreadApi } = require('./renderer/unread')
const { createLockApi } = require('./renderer/lock')
const { createCloudUiApi } = require('./renderer/cloud-ui')
const { createContextMenusApi } = require('./renderer/context-menus')
const { createFoldersUiApi } = require('./renderer/folders-ui')
const { createSearchUiApi } = require('./renderer/search-ui')
const { createAddModalUiApi } = require('./renderer/add-modal-ui')
const { createSettingsUiApi } = require('./renderer/settings-ui')
const { createChangeIconUiApi } = require('./renderer/change-icon-ui')
const { createMessengerSoundUiApi } = require('./renderer/messenger-sound-ui')
const { createSidebarDndApi } = require('./renderer/sidebar-dnd-bind')
const { createExtensionsUiApi } = require('./renderer/extensions-ui')
const { createWebviewNotifyApi } = require('./renderer/webview-notify')
const { createWebviewTabsApi } = require('./renderer/webview-tabs-bind')

const { bindSettingsUi } = require('./renderer/settings-bind')
const { bindLockUi } = require('./renderer/lock-bind')
const { bindCloudUi } = require('./renderer/cloud-bind')
const { bindMenuUi } = require('./renderer/menu-bind')
const { bindWindowUi } = require('./renderer/window-bind')
const { bindAppEvents } = require('./renderer/app-events-bind')
const { bindEditModalUi } = require('./renderer/edit-modal-bind')
const { bindAddModalUi } = require('./renderer/add-modal-bind')
const { bindContextActionsUi } = require('./renderer/context-actions-bind')
const { bindChangeIconUi } = require('./renderer/change-icon-bind')
const { bindMessengerSoundUi } = require('./renderer/messenger-sound-bind')
const { bindSidebarShellUi } = require('./renderer/sidebar-shell-bind')
const { bindAppNotifUi } = require('./renderer/app-notif-bind')
const { bindVpnUi, bindVpnSettings } = require('./renderer/vpn-bind')

// ==============================
// SHIM ДЛЯ STORE
// Делаем объект, похожий на electron-store,
// чтобы старые модули не пришлось срочно переписывать
// ==============================
const storeCache = new Map()

const store = {
    async hydrate(keysWithDefaults = []) {
        for (const [key, def] of keysWithDefaults) {
            try {
                if (window.electronAPI?.storeGet) {
                    const value = await window.electronAPI.storeGet(key, def)
                    storeCache.set(key, value === undefined ? def : value)
                } else {
                    storeCache.set(key, def)
                }
            } catch (error) {
                console.error(`store.hydrate error for key "${key}":`, error)
                storeCache.set(key, def)
            }
        }
    },

    get(key, def) {
        return storeCache.has(key) ? storeCache.get(key) : def
    },

    async getAsync(key, def) {
        if (storeCache.has(key)) return storeCache.get(key)

        try {
            if (window.electronAPI?.storeGet) {
                const value = await window.electronAPI.storeGet(key, def)
                const finalValue = value === undefined ? def : value
                storeCache.set(key, finalValue)
                return finalValue
            }
        } catch (error) {
            console.error(`store.getAsync error for key "${key}":`, error)
        }

        storeCache.set(key, def)
        return def
    },

    set(key, value) {
        storeCache.set(key, value)

        if (window.electronAPI?.storeSet) {
            return window.electronAPI.storeSet(key, value)
        }

        return undefined
    },

    async setAsync(key, value) {
        storeCache.set(key, value)

        if (window.electronAPI?.storeSet) {
            return await window.electronAPI.storeSet(key, value)
        }

        return undefined
    },

    delete(key) {
        storeCache.delete(key)

        if (window.electronAPI?.storeDelete) {
            return window.electronAPI.storeDelete(key)
        }

        return undefined
    }
}

// ==============================
// SHIM ДЛЯ IPC
// Имитируем старый ipcRenderer / invokeIpc,
// чтобы модули, которые их ждут, продолжили работать
// ==============================
const ipcRenderer = {
    send(channel, ...args) {
        if (window.electronAPI?.send) {
            return window.electronAPI.send(channel, ...args)
        }

        if (channel === 'set-app-zoom' && window.electronAPI?.setAppZoom) {
            return window.electronAPI.setAppZoom(args[0])
        }

        if (window.electronAPI?.ipcSend) {
            return window.electronAPI.ipcSend(channel, ...args)
        }
    },

    invoke(channel, ...args) {
        if (window.electronAPI?.invoke) {
            return window.electronAPI.invoke(channel, ...args)
        }

        if (window.electronAPI?.ipcInvoke) {
            return window.electronAPI.ipcInvoke(channel, ...args)
        }

        return Promise.resolve(null)
    },

    on(channel, listener) {
        if (window.electronAPI?.on) {
            return window.electronAPI.on(channel, listener)
        }

        if (window.electronAPI?.ipcOn) {
            return window.electronAPI.ipcOn(channel, listener)
        }
    },

    once(channel, listener) {
        if (window.electronAPI?.once) {
            return window.electronAPI.once(channel, listener)
        }
    },

    removeListener(channel, listener) {
        if (window.electronAPI?.removeListener) {
            return window.electronAPI.removeListener(channel, listener)
        }
    }
}

function invokeIpc(channel, ...args) {
    if (window.electronAPI?.invoke) {
        return window.electronAPI.invoke(channel, ...args)
    }

    if (window.electronAPI?.ipcInvoke) {
        return window.electronAPI.ipcInvoke(channel, ...args)
    }

    if (channel === 'app:getVersion' && window.electronAPI?.getAppVersion) {
        return window.electronAPI.getAppVersion()
    }

    if (channel === 'app:checkForUpdates' && window.electronAPI?.checkForUpdates) {
        return window.electronAPI.checkForUpdates()
    }

    return Promise.resolve(null)
}

const STARTUP_STAGES = {
    boot: {
        label: 'Инициализация',
        hint: 'Запускаем основные сервисы...'
    },
    store: {
        label: 'Загрузка данных',
        hint: 'Читаем настройки и локальное состояние...'
    },
    i18n: {
        label: 'Локализация',
        hint: 'Применяем язык интерфейса...'
    },
    ui: {
        label: 'Подготовка UI',
        hint: 'Собираем интерфейс и компоненты...'
    },
    bindings: {
        label: 'Подключение модулей',
        hint: 'Связываем обработчики и системные функции...'
    },
    data: {
        label: 'Загрузка рабочего пространства',
        hint: 'Подключаем мессенджеры, вкладки и папки...'
    },
    security: {
        label: 'Проверка защиты',
        hint: 'Проверяем параметры безопасности...'
    },
    done: {
        label: 'Готово',
        hint: 'Рабочее пространство готово к использованию.'
    }
}

function getStartupUi() {
    return {
        splash: document.getElementById('startupSplash'),
        appRoot: document.getElementById('appRoot'),
        progressFill: document.getElementById('startupProgressFill'),
        progressText: document.getElementById('startupProgressText'),
        stageText: document.getElementById('startupStageText'),
        hintText: document.getElementById('startupHintText')
    }
}

function setStartupStage(stageKey) {
    const { stageText, hintText } = getStartupUi()
    const stage = STARTUP_STAGES[stageKey]
    if (!stage) return

    if (stageText) {
        stageText.style.opacity = '0.35'
        stageText.style.transform = 'translateY(2px)'

        setTimeout(() => {
            stageText.textContent = stage.label
            stageText.style.opacity = '1'
            stageText.style.transform = 'translateY(0)'
        }, 90)
    }

    if (hintText) {
        hintText.style.opacity = '0.35'
        hintText.style.transform = 'translateY(2px)'

        setTimeout(() => {
            hintText.textContent = stage.hint
            hintText.style.opacity = '1'
            hintText.style.transform = 'translateY(0)'
        }, 90)
    }
}

function setStartupProgress(value) {
    const { progressFill, progressText } = getStartupUi()
    const safeValue = Math.max(0, Math.min(100, Math.round(value)))

    if (progressFill) {
        progressFill.style.width = `${safeValue}%`
    }

    if (progressText) {
        progressText.textContent = `${safeValue}%`
    }
}

function showAppRoot() {
    const { appRoot } = getStartupUi()
    if (!appRoot) return

    appRoot.classList.remove('app-root-hidden')
    appRoot.classList.add('app-root-ready')
}

function hideStartupSplash() {
    const { splash } = getStartupUi()
    if (!splash) return

    splash.classList.add('hidden')
}

function finishStartup({ locked = false } = {}) {
    showAppRoot()

    if (locked) {
        document.body.classList.add('startup-locked')
    } else {
        document.body.classList.remove('startup-locked')
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            hideStartupSplash()
        })
    })
}

function animateProgress(from, to, duration = 320) {
    const start = performance.now()
    const safeFrom = Math.max(0, Math.min(100, from))
    const safeTo = Math.max(0, Math.min(100, to))

    return new Promise((resolve) => {
        function frame(now) {
            const progress = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - progress, 3)
            const value = safeFrom + (safeTo - safeFrom) * eased

            setStartupProgress(value)

            if (progress < 1) {
                requestAnimationFrame(frame)
                return
            }

            setStartupProgress(safeTo)
            resolve()
        }

        requestAnimationFrame(frame)
    })
}

async function fakeProgressTo(target, { minStepTime = 180 } = {}) {
    const currentText = document.getElementById('startupProgressText')?.textContent || '0%'
    const current = parseInt(currentText, 10) || 0
    const finalTarget = Math.max(current, Math.min(100, target))

    if (current >= finalTarget) {
        setStartupProgress(finalTarget)
        return
    }

    await Promise.all([
        animateProgress(current, finalTarget, Math.max(minStepTime, (finalTarget - current) * 18)),
        new Promise((resolve) => setTimeout(resolve, minStepTime))
    ])
}

async function advanceStartup(stageKey, percent, options = {}) {
    setStartupStage(stageKey)
    await fakeProgressTo(percent, options)
}

async function bootstrap() {
    setStartupStage('boot')
    setStartupProgress(2)
    await advanceStartup('boot', 10, { minStepTime: 220 })
    await store.hydrate([
        ['menuCollapsed', false],
        ['appZoomLevel', 0],
        ['tabZoomLevel', 1],
        ['settings', {}],
        ['security', {}],
        ['pinEnabled', false],
        ['pinHash', ''],
        ['lockOnStartup', false],
        ['messengers', []],
        ['folders', []],
        ['mutedMessengers', {}],
        ['globalMuteAll', false],
        // Cloud auth — must be hydrated so tokens survive restart
        ['cloud.accessToken', null],
        ['cloud.refreshToken', null],
        ['cloud.user', null],
        ['cloud.lastSyncAt', null],
        ['cloud.lastSyncError', null]
    ])

    await advanceStartup('store', 24, { minStepTime: 240 })
    await initI18n()
     await advanceStartup('i18n', 34, { minStepTime: 220 })
    // ==============================
    // НАЧАЛЬНОЕ СОСТОЯНИЕ
    // ==============================
    state.modalFiltered = [...popularMessengers]
    state.menuCollapsed = await store.getAsync('menuCollapsed', false)
    state.appZoomLevel = await store.getAsync('appZoomLevel', 0)
    state.tabZoomLevel = await store.getAsync('tabZoomLevel', 1)

    // ==============================
    // СОЗДАНИЕ СЛУЖЕБНЫХ DOM-ЭЛЕМЕНТОВ
    // ==============================
    const folderPanel = document.createElement('div')
    folderPanel.id = 'folderPanel'
    folderPanel.className = 'folder-panel'
    folderPanel.innerHTML = `
        <div class="folder-panel-label">
            <button class="folder-panel-close" id="folderPanelClose">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <span class="folder-panel-name" id="folderPanelName"></span>
        </div>
        <div class="folder-panel-content" id="folderPanelContent"></div>
    `
    document.body.appendChild(folderPanel)

    const tooltip = document.createElement('div')
    tooltip.className = 'sidebar-tooltip'
    tooltip.id = 'sidebarTooltip'
    document.body.appendChild(tooltip)

    const pinInputNew = document.createElement('input')
    pinInputNew.type = 'tel'
    pinInputNew.maxLength = 4
    pinInputNew.autocomplete = 'off'
    pinInputNew.style.cssText = 'position:fixed;top:-999px;left:-999px;width:1px;height:1px;opacity:0;pointer-events:none;'
    pinInputNew.id = '_pinInputNew'
    document.body.appendChild(pinInputNew)

    const pinInputConfirm = document.createElement('input')
    pinInputConfirm.type = 'tel'
    pinInputConfirm.maxLength = 4
    pinInputConfirm.autocomplete = 'off'
    pinInputConfirm.style.cssText = 'position:fixed;top:-999px;left:-999px;width:1px;height:1px;opacity:0;pointer-events:none;'
    pinInputConfirm.id = '_pinInputConfirm'
    document.body.appendChild(pinInputConfirm)

    const pinDisableInput = document.createElement('input')
    pinDisableInput.type = 'tel'
    pinDisableInput.maxLength = 4
    pinDisableInput.autocomplete = 'off'
    pinDisableInput.style.cssText = 'position:fixed;top:-999px;left:-999px;width:1px;height:1px;opacity:0;'
    pinDisableInput.id = '_pinDisableInput'
    document.body.appendChild(pinDisableInput)

    // ==============================
    // ОСНОВНЫЕ DOM-ССЫЛКИ
    // ==============================
    const messengerList = document.getElementById('messengerList')
    const tabsBar = document.getElementById('tabsBar')
    const tabsContent = document.getElementById('tabsContent')
    const welcomeScreen = document.getElementById('welcomeScreen')
    const addModal = document.getElementById('addModal')
    const messengerGrid = document.getElementById('messengerGrid')
    const contextMenu = document.getElementById('contextMenu')
    const folderContextMenu = document.getElementById('folderContextMenu')
    const folderPickMenu = document.getElementById('folderPickMenu')
    const editModal = document.getElementById('editModal')
    const findBar = document.getElementById('findBar')
    const findInput = document.getElementById('findInput')
    const findCount = document.getElementById('findCount')
    const quickSearch = document.getElementById('quickSearch')
    const quickSearchInput = document.getElementById('quickSearchInput')
    const quickSearchResults = document.getElementById('quickSearchResults')
    const webviewContextMenu = document.getElementById('webviewContextMenu')
    const sidebarContextMenu = document.getElementById('sidebarContextMenu')
    const menuToggleBtn = document.getElementById('menuToggleBtn')
    const titlebarMenu = document.getElementById('titlebarMenu')
    const menuToggleIcon = document.getElementById('menuToggleIcon')


     await advanceStartup('ui', 46, { minStepTime: 260 })
    // ==============================
    // CLOUD API
    // ==============================
    const cloudStore = createCloudStore(store)

    const cloudApi = createCloudApi({
        store,
        cloudStore,
        invokeIpc,
        getSyncPayload: () => {
            const messengers = state.activeMessengers.map((m, idx) => ({
                id: m.id,
                name: m.name,
                url: m.url,
                icon: m.icon,
                color: m.color,
                isMuted: state.mutedMessengers[m.id] || false,
                notifSound: m.notifSound || '__default__',
                folderId: m.folderId || null,
                position: idx,
                zoomLevel: typeof m.zoomLevel === 'number' ? m.zoomLevel : 1
            }))

            const folders = state.folders.map((f, idx) => ({
                id: f.id,
                name: f.name,
                icon: f.icon,
                position: idx
            }))

            const settings = store.get('settings', {}) || {}

            return {
                messengers,
                folders,
                settings: {
                    theme: settings.theme || 'dark',
                    accentColor: settings.accentColor || '#7b68ee',
                    density: settings.density || 'comfortable',
                    language: settings.language || 'ru',
                    sidebarPosition: settings.sidebarPosition || 'left',
                    showTabs: settings.showTabs !== false,
                    notifications: settings.notifications !== false,
                    notifSound: settings.notifSound !== false,
                    foldersEnabled: settings.foldersEnabled !== false,
                    globalMuteAll: state.globalMuteAll || false,
                    extra: {
                        // Блокировка: читаем из 'security' (именно там сохраняет lock.js)
                        pinEnabled:    store.get('security', {}).enabled  || false,
                        pinHash:       store.get('security', {}).hash     || '',
                        lockOnHide:    store.get('security', {}).lockOnHide || false,
                        lockOnStartup: store.get('lockOnStartup', false),
                        tabZoomLevel:  settings.tabZoomLevel || 1,
                        activeTabId:   state.activeTabId || null
                    }
                }
            }
        },
        onAuthUpdated: () => updateCloudBtn()
    })

    const { cloudSyncPush, cloudSyncPull, authorizedInvoke } = cloudApi

    // После входа на новом устройстве: тянем облако → применяем → перезагружаем
    // Если облако пустое — пушим локальные данные
    async function cloudSyncAfterLogin() {
        try {
            // Обновляем данные пользователя с сервера (план, аватар и т.д.)
            await cloudApi.refreshUser()
            if (typeof updateCloudBtn === 'function') updateCloudBtn()

            const cloudData = await cloudSyncPull()
            const hasData = (cloudData?.messengers?.length > 0) || (cloudData?.folders?.length > 0)
            if (hasData) {
                // Используем setAsync чтобы гарантировать запись в store до перезагрузки
                await store.setAsync('messengers', cloudData.messengers.map(m => ({
                    id: m.id,
                    name: m.name,
                    url: m.url,
                    icon: m.icon || null,
                    color: m.color || null,
                    folderId: m.folderId || null,
                    notifSound: m.notifSound || '__default__',
                    zoomLevel: typeof m.zoomLevel === 'number' ? m.zoomLevel : 1
                })))
                await store.setAsync('folders', cloudData.folders || [])
                if (cloudData.settings) {
                    const { extra, ...baseSettings } = cloudData.settings
                    const cur = store.get('settings', {}) || {}
                    await store.setAsync('settings', { ...cur, ...baseSettings })
                    if (extra) {
                        // Восстанавливаем блокировку в 'security' (именно там читает lock.js)
                        if (extra.pinEnabled !== undefined || extra.pinHash !== undefined) {
                            const sec = store.get('security', {})
                            await store.setAsync('security', {
                                ...sec,
                                enabled:    extra.pinEnabled  !== undefined ? extra.pinEnabled  : sec.enabled,
                                hash:       extra.pinHash     !== undefined ? extra.pinHash      : sec.hash,
                                lockOnHide: extra.lockOnHide  !== undefined ? extra.lockOnHide   : sec.lockOnHide
                            })
                        }
                        if (extra.lockOnStartup !== undefined) await store.setAsync('lockOnStartup', extra.lockOnStartup)
                    }
                }
                const muted = {}
                cloudData.messengers.forEach(m => { if (m.isMuted) muted[m.id] = true })
                await store.setAsync('mutedMessengers', muted)
                // Перезагружаем приложение чтобы применить все данные
                sessionStorage.setItem('_centrio_post_login_reload', '1')
                window.location.reload()
            } else {
                // Облако пустое — загружаем локальные данные на сервер
                await cloudSyncPush()
                // Подгружаем уведомления (пользователь залогинен, перезагрузки нет)
                appNotifApi?.fetchNotifications?.()
            }
        } catch {
            await cloudSyncPush()
        }
    }

    // ==============================
    // SOUNDS API
    // ==============================
    const soundsApi = createSoundsApi({
        store,
        ipcRenderer,
        getActiveMessengers: () => state.activeMessengers
    })

    const { playNotifSound, initSoundPicker, previewMessengerSound } = soundsApi

    // ==============================
    // DOWNLOADS API
    // ==============================
    const downloadsApi = bindDownloads({
        store,
        ipcRenderer,
        invokeIpc,
        tGet
    })

    const { updateDownloadDirUI } = downloadsApi

    // ==============================
    // STATUS BAR API
    // ==============================
    const statusBarApi = createStatusBarApi({
        store,
        state,
        tGet,
        getCurrentLocale
    })

    const { updateStatusBar, updateZoomStatus } = statusBarApi
    updateStatusBar() // сразу показываем время и дату при старте

    // ==============================
    // TOOLTIPS API
    // ==============================
    const tooltipsApi = createTooltipsApi({
        state,
        tooltip
    })

    const { showTooltip, hideTooltip } = tooltipsApi

    // ==============================
    // UNREAD API
    // ==============================
    const unreadApi = createUnreadApi({
        state,
        store,
        tGet,
        ipcRenderer,
        updateStatusBar,
        updateFolderBadge: (...args) => updateFolderBadge(...args)
    })

    const {
        isMessengerMuted,
        resetMessengerNotifyState,
        updateMuteIcon,
        updateContextMuteLabel,
        updateMuteAllBtn,
        updateUnreadCount,
        toggleMuteAll
    } = unreadApi

    // ==============================
    // WEBVIEW NOTIFY API
    // ==============================
    let addMessengerNotifRef = null

    const webviewNotifyApi = createWebviewNotifyApi({
        state,
        store,
        tGet,
        ipcRenderer,
        invokeIpc,
        playNotifSound,
        isMessengerMuted,
        updateUnreadCount,
        addMessengerNotification: (title, body, name) => {
            if (typeof addMessengerNotifRef === 'function') {
                addMessengerNotifRef(title, body, name)
            }
        }
    })

    const { watchWebview } = webviewNotifyApi

    // ==============================
    // СОХРАНЕНИЕ ДАННЫХ
    // ==============================
    function saveData() {
        const messengers = state.activeMessengers.map(m => ({
            name: m.name,
            url: m.url,
            icon: m.icon,
            color: m.color,
            id: m.id,
            folderId: m.folderId || null,
            notifSound: m.notifSound || '__default__',
            zoomLevel: typeof m.zoomLevel === 'number' ? m.zoomLevel : 1
        }))

        store.set('messengers', messengers)
        store.set('folders', state.folders)
        store.set('mutedMessengers', state.mutedMessengers)
        store.set('globalMuteAll', state.globalMuteAll)

        if (cloudStore.isLoggedIn()) cloudSyncPush()
    }

    // ==============================
    // СОЗДАНИЕ ЭЛЕМЕНТА МЕССЕНДЖЕРА
    // ==============================
    function createMessengerItem(messenger) {
        const item = document.createElement('div')
        item.className = 'messenger-item'
        item.id = `sidebar-${messenger.id}`

        const hostname = (() => {
            try {
                return new URL(messenger.url).hostname
            } catch {
                return ''
            }
        })()

        const iconSources = [
            messenger.icon,
            `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
            `https://icon.horse/icon/${hostname}`
        ]

        const vpnModes = store.get('vpnAppModes', {}) || {}
        const hasVpn   = vpnModes[messenger.id] === true

        item.innerHTML = `
            <div class="messenger-icon-wrap">
                <img class="messenger-icon"
                     src="${iconSources[0]}"
                     alt="${messenger.name}"
                     data-sources='${JSON.stringify(iconSources)}'
                     data-index="0">
                ${hasVpn ? '<span class="vpn-badge" title="VPN включён">🛡</span>' : ''}
            </div>
            <span class="messenger-name">${messenger.name}</span>
        `

        const img = item.querySelector('img')
        img.addEventListener('error', function () {
            const sources = JSON.parse(this.dataset.sources)
            const nextIndex = parseInt(this.dataset.index, 10) + 1

            if (nextIndex < sources.length) {
                this.dataset.index = String(nextIndex)
                this.src = sources[nextIndex]
                return
            }

            this.style.display = 'none'
            const letter = document.createElement('div')
            letter.className = 'messenger-letter'
            letter.textContent = messenger.name[0].toUpperCase()
            this.parentElement.insertBefore(letter, this)
        })

        item.addEventListener('click', () => switchTab(messenger.id))
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            e.stopPropagation()
            showContextMenu(e, messenger.id)
        })

        if (isMessengerMuted(messenger.id)) updateMuteIcon(messenger.id)

        initDrag(item, messenger.id, 'messenger')
        initDropTarget(item, messenger.id, 'messenger')

        item.addEventListener('mouseenter', () => {
            if (item.closest('.folder-panel-content')) return
            showTooltip(item, messenger.name, state.unreadCounts[messenger.id] || 0)
        })

        item.addEventListener('mouseleave', hideTooltip)
        return item
    }

    // ==============================
    // АНИМАЦИЯ ДОБАВЛЕНИЯ
    // ==============================
    function animateMessengerAdd(element) {
        if (!element) return
        element.classList.add('just-added')
        element.addEventListener('animationend', () => element.classList.remove('just-added'), { once: true })
    }

    // ==============================
    // ДОБАВЛЕНИЕ В SIDEBAR
    // ==============================
    function addToSidebar(messenger) {
        const item = createMessengerItem(messenger)
        const zone = messengerList.querySelector('.sidebar-root-drop-zone')
        if (zone) messengerList.insertBefore(item, zone)
        else messengerList.appendChild(item)
        animateMessengerAdd(item)
    }

    // ==============================
    // FOLDERS UI API
    // ==============================
    const foldersUiApi = createFoldersUiApi({
        state,
        store,
        folderPanel,
        messengerList,
        renderMessengerItem: createMessengerItem,
        addToSidebar,
        saveData
    })

    const {
        updateFolderBadge,
        renderFolderPanel,
        closeFolderPanel,
        toggleFolderPanel,
        addToFolder,
        removeFolder,
        applyFoldersEnabled
    } = foldersUiApi

    // ==============================
    // LOCK API
    // ==============================
    const lockApi = createLockApi({
        state,
        store,
        tGet,
        ipcRenderer,
        hashPassword,
        pinInputNew,
        pinInputConfirm,
        pinDisableInput
    })

    const {
        isPasswordEnabled,
        updateLockBtn,
        checkLockOnStart,
        updateLockDots,
        showLockScreen,
        tryUnlock,
        updateSetPinDots,
        setActivePinBlock,
        resetPinSetup,
        savePinClick,
        handlePinInput,
        updateDisableDots,
        openPinDisableModal,
        closePinDisableModal,
        tryDisablePin,
        showForgotPinConfirm
    } = lockApi

    // ==============================
    // CLOUD UI API
    // ==============================
    const cloudUiApi = createCloudUiApi({
        cloudStore,
        tGet,
        getUserInitial,
        getLocalStats: () => ({
            messengers: state.activeMessengers.length,
            folders:    state.folders.length,
            lastSyncAt: cloudStore.getLastSyncAt()
        })
    })

    const {
        updateCloudBtn,
        updateAvatarInModal,
        openCloudLogin,
        openCloudProfile,
        renderLocalStats
    } = cloudUiApi

    // ==============================
    // ПЕРЕМЕЩЕНИЕ МЕССЕНДЖЕРА В ПАПКУ
    // ==============================
    function moveMessengerToFolder(messengerId, folderId) {
        const messenger = state.activeMessengers.find(m => m.id === messengerId)
        if (!messenger) return

        const oldFolderId = messenger.folderId
        document.getElementById(`sidebar-${messengerId}`)?.remove()
        messenger.folderId = folderId || null

        if (folderId) {
            addToFolder(messenger, folderId)
            updateFolderBadge(folderId)
        } else {
            addToSidebar(messenger)
        }

        if (oldFolderId) updateFolderBadge(oldFolderId)

        if (state.activeFolderPanelId === folderId || state.activeFolderPanelId === oldFolderId) {
            if (state.activeFolderPanelId) renderFolderPanel(state.activeFolderPanelId)
        }

        saveData()
    }

    // ==============================
    // CONTEXT MENUS API
    // ==============================
    const contextMenusApi = createContextMenusApi({
        state,
        contextMenu,
        folderContextMenu,
        folderPickMenu,
        sidebarContextMenu,
        webviewContextMenu,
        folderIcons,
        tGet,
        getActiveMessengers: () => state.activeMessengers,
        moveMessengerToFolder,
        updateContextMuteLabel
    })

    const {
        hideAllMenus,
        showContextMenu,
        showFolderContextMenu
    } = contextMenusApi

    // ==============================
    // РЕНДЕР ПАПКИ
    // ==============================
    function renderFolder(folder) {
        const folderEl = document.createElement('div')
        folderEl.className = 'folder-item'
        folderEl.id = `folder-${folder.id}`

        const iconSvg = folderIcons[folder.icon] || folderIcons.folder
        folderEl.innerHTML = `
            <div class="folder-header">
                <div class="folder-icon-wrap">${iconSvg}</div>
            </div>
            <div class="folder-children" id="folder-children-${folder.id}"></div>
        `

        const header = folderEl.querySelector('.folder-header')
        header.addEventListener('click', () => toggleFolderPanel(folder.id))
        header.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            e.stopPropagation()
            state.contextTargetFolderId = folder.id
            showFolderContextMenu(e, folder.id)
        })

        initDrag(folderEl, folder.id, 'folder')
        initDropTarget(folderEl, folder.id, 'folder')

        header.addEventListener('mouseenter', () => {
            const total = state.activeMessengers
                .filter(m => m.folderId === folder.id)
                .reduce((sum, m) => sum + (state.unreadCounts[m.id] || 0), 0)

            showTooltip(header, folder.name, total)
        })

        header.addEventListener('mouseleave', hideTooltip)
        const zone = messengerList.querySelector('.sidebar-root-drop-zone')
        if (zone) messengerList.insertBefore(folderEl, zone)
        else messengerList.appendChild(folderEl)
    }

    function markWebviewReady(webview) {
    if (!webview) return

    if (webview.dataset.domReadyBound === 'true') return
    webview.dataset.domReadyBound = 'true'

    webview.addEventListener('dom-ready', () => {
        webview.dataset.domReady = 'true'

        const pendingZoom = Number(webview.dataset.pendingZoom)
        if (!Number.isNaN(pendingZoom) && pendingZoom > 0) {
            try {
                webview.setZoomFactor(pendingZoom)
            } catch (error) {
                console.error('Failed to apply pending zoom:', error)
            }
            delete webview.dataset.pendingZoom
        }
    })
}

function applyZoomWhenReady(webview, zoomLevel) {
    if (!webview) return

    markWebviewReady(webview)

    if (webview.dataset.domReady === 'true') {
        try {
            webview.setZoomFactor(zoomLevel)
        } catch (error) {
            console.error('Failed to set webview zoom:', error)
        }
        return
    }

    webview.dataset.pendingZoom = String(zoomLevel)
}

    // ==============================
    // ПЕРЕКЛЮЧЕНИЕ ВКЛАДКИ
    // ==============================

    // ── Tab time tracker state ────────────────────────────────────
    let _tkPrevId    = null   // previous messenger id
    let _tkPrevName  = null   // previous messenger name
    let _tkStart     = 0      // when current tab became active

function switchTab(id) {
    // Track time spent on previous tab
    if (_tkPrevId && _tkPrevName && _tkStart > 0) {
        const secs = Math.floor((Date.now() - _tkStart) / 1000)
        if (secs > 0) {
            invokeIpc('tracker:service-time', { service: _tkPrevName, serviceTime: secs })
                .catch(() => {})
        }
    }
    // Update tracker state for new tab
    const _nextMessenger = state.activeMessengers.find(m => m.id === id)
    _tkPrevId   = id
    _tkPrevName = _nextMessenger?.name || null
    _tkStart    = Date.now()

    state.activeTabId = id

    document.querySelectorAll('.messenger-item').forEach(item => item.classList.remove('active'))
    const sidebarItem = document.getElementById(`sidebar-${id}`)
    if (sidebarItem) {
        sidebarItem.classList.add('active')
        const folderChildren = sidebarItem.closest('.folder-children')
        if (folderChildren) folderChildren.closest('.folder-item')?.classList.add('open')
    }

    document.querySelectorAll('.tab').forEach(tabEl => tabEl.classList.remove('active'))
    const tab = document.getElementById(`tab-${id}`)
    if (tab) {
        tab.classList.add('active')
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }

    document.querySelectorAll('webview').forEach(wv => wv.classList.remove('active'))

    const activeWebview = document.getElementById(`webview-${id}`)
    const activeMessenger = state.activeMessengers.find(m => m.id === id)

    if (activeMessenger) {
        state.tabZoomLevel = typeof activeMessenger.zoomLevel === 'number'
            ? activeMessenger.zoomLevel
            : (store.get('tabZoomLevel', 1) || 1)
    } else {
        state.tabZoomLevel = store.get('tabZoomLevel', 1) || 1
    }

    if (activeWebview) {
        activeWebview.classList.add('active')
        applyZoomWhenReady(activeWebview, state.tabZoomLevel)
    }

    updateZoomStatus()
}

    // ==============================
    // SEARCH UI API
    // ==============================
    const searchUiApi = createSearchUiApi({
        state,
        quickSearch,
        quickSearchInput,
        quickSearchResults,
        findBar,
        findInput,
        findCount,
        tGet,
        switchTab,
        isMessengerMuted
    })

    const {
        openFindBar,
        closeFindBar,
        openQuickSearch,
        closeQuickSearch
    } = searchUiApi

    // ==============================
    // ПОЛУЧЕНИЕ АКТИВНОГО WEBVIEW
    // ==============================
    function getActiveWebview() {
        if (!state.activeTabId) return null
        return document.getElementById(`webview-${state.activeTabId}`)
    }

    // ==============================
    // ИЗМЕНЕНИЕ TAB ZOOM
    // ==============================
function applyTabZoom(level) {
    const nextZoom = Math.max(0.25, Math.min(5, level))
    state.tabZoomLevel = nextZoom
    store.set('tabZoomLevel', nextZoom)

    const activeMessenger = state.activeMessengers.find(m => m.id === state.activeTabId)
    if (activeMessenger) {
        activeMessenger.zoomLevel = nextZoom
    }

    const webview = getActiveWebview()
    if (webview) {
        applyZoomWhenReady(webview, nextZoom)
    }

    saveData()
    updateZoomStatus()
}

    // ==============================
    // УДАЛЕНИЕ МЕССЕНДЖЕРА
    // ==============================
    function removeMessenger(id) {
        const messenger = state.activeMessengers.find(m => m.id === id)
        const folderId = messenger?.folderId

        state.activeMessengers = state.activeMessengers.filter(m => m.id !== id)
        delete state.unreadCounts[id]
        delete state.rawUnreadCounts[id]
        delete state.mutedMessengers[id]
        delete state.messengerNotifyState[id]
        delete state.siteNotificationState[id]
        state.webviewWatchBound.delete(`webview-${id}`)

        document.getElementById(`sidebar-${id}`)?.remove()
        document.getElementById(`tab-${id}`)?.remove()
        document.getElementById(`webview-${id}`)?.remove()

        if (folderId) updateFolderBadge(folderId)

        if (state.activeMessengers.length > 0) {
            switchTab(state.activeMessengers[state.activeMessengers.length - 1].id)
        } else {
            welcomeScreen.style.display = 'flex'
            state.activeTabId = null
        }

        tabsContent.style.pointerEvents = state.activeMessengers.length > 0 ? 'auto' : 'none'
        saveData()
        updateStatusBar()
    }

    const preloadPath = window.electronAPI?.getWebviewPreloadPath
    ? await window.electronAPI.getWebviewPreloadPath()
    : ''
    // ==============================
    // WEBVIEW TABS API
    // ==============================
    const webviewTabsApi = createWebviewTabsApi({
        state,
        tabsBar,
        tabsContent,
        findCount,
        webviewContextMenu,
        showContextMenu,
        preloadPath,
        ipcRenderer,
        invokeIpc,
        tGet,
        openFindBar,
        openSettings: () => { if (typeof openSettingsRef === 'function') openSettingsRef() },
        getActiveWebview,
        applyTabZoom,
        switchTab,
        removeMessenger,
        watchWebview
    })

    const {
        addTab,
        addWebview,
        bindWebviewContextMenuActions
    } = webviewTabsApi

    // ==============================
    // ADD MODAL UI API
    // ==============================
    const addModalUiApi = createAddModalUiApi({
        state,
        popularMessengers,
        PAGE_SIZE,
        addModal,
        messengerGrid,
        addMessenger
    })

    const {
        fillMessengerGrid,
        openModal,
        closeModal
    } = addModalUiApi

    // ==============================
    // UPGRADE MODAL HELPERS
    // ==============================
    function showUpgradeModal(title, desc) {
        const modal = document.getElementById('upgradeModal')
        if (!modal) return
        const titleEl = document.getElementById('upgradeModalTitle')
        const descEl  = document.getElementById('upgradeModalDesc')
        if (title && titleEl) titleEl.textContent = title
        if (desc  && descEl)  descEl.textContent  = desc
        modal.classList.add('show')
    }

    document.getElementById('upgradeModalClose')?.addEventListener('click', () => {
        document.getElementById('upgradeModal')?.classList.remove('show')
    })
    document.getElementById('upgradeModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('upgradeModal'))
            document.getElementById('upgradeModal').classList.remove('show')
    })

    // Возвращает true если план PRO/TEAM, иначе показывает модалку и возвращает false
    // featureKey: 'themes' | 'accent' | 'folders' | 'sound' | 'messengerLimit'
    function requirePro(featureKey) {
        const user = cloudStore.getUser()
        const plan = (user?.plan || 'FREE').toUpperCase()
        if (plan === 'FREE') {
            showUpgradeModal(
                tGet(`pro.${featureKey}Title`),
                tGet(`pro.${featureKey}Desc`)
            )
            return false
        }
        return true
    }

    // ==============================
    // ДОБАВЛЕНИЕ МЕССЕНДЖЕРА
    // ==============================
    function addMessenger(messenger) {
        // ── Plan limits ──────────────────────────────────────────
        const user = cloudStore.getUser()
        const plan = (user?.plan || 'FREE').toUpperCase()
        const FREE_MESSENGER_LIMIT = 3
        if (plan === 'FREE' && state.activeMessengers.length >= FREE_MESSENGER_LIMIT) {
            showUpgradeModal(
                tGet('pro.messengerLimitTitle'),
                tGet('pro.messengerLimitDesc').replace('{n}', FREE_MESSENGER_LIMIT)
            )
            return
        }
        // ─────────────────────────────────────────────────────────

        const id = Date.now().toString()
        const sameCount = state.activeMessengers.filter(m => m.name.startsWith(messenger.name)).length
        const name = sameCount > 0 ? `${messenger.name} ${sameCount + 1}` : messenger.name

        const newMessenger = {
            ...messenger,
            id,
            name,
            folderId: null,
            notifSound: '__default__',
            zoomLevel: state.tabZoomLevel || store.get('tabZoomLevel', 1) || 1
        }

        state.activeMessengers.push(newMessenger)
        addToSidebar(newMessenger)
        addTab(newMessenger)
        addWebview(newMessenger)
        switchTab(id)

        welcomeScreen.style.display = 'none'
        tabsContent.style.pointerEvents = 'auto'
        state.rawUnreadCounts[id] = 0
        state.unreadCounts[id] = 0
        resetMessengerNotifyState(id, 0)

        saveData()
        updateStatusBar()
    }

    // ==============================
    // ИЗМЕНЕНИЕ APP ZOOM
    // ==============================
    function applyAppZoom(level) {
        state.appZoomLevel = Math.max(-3, Math.min(3, level))
        store.set('appZoomLevel', state.appZoomLevel)

        if (window.electronAPI?.setAppZoom) {
            window.electronAPI.setAppZoom(state.appZoomLevel)
        } else {
            ipcRenderer.send('set-app-zoom', state.appZoomLevel)
        }

        updateZoomStatus()
    }

    // ==============================
    // COLLAPSE/EXPAND MENU
    // ==============================
    function applyMenuCollapsed() {
        titlebarMenu.classList.toggle('collapsed', state.menuCollapsed)
        menuToggleBtn.classList.toggle('collapsed', state.menuCollapsed)

        menuToggleIcon.innerHTML = state.menuCollapsed
            ? '<path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
            : '<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    }

    // ==============================
    // SIDEBAR DRAG-N-DROP API
    // ==============================
    // ==============================
    // EXTENSIONS UI API
    // ==============================
    const extensionsUiApi = createExtensionsUiApi({
        invokeIpc,
        tGet,
        requirePro
    })

    const sidebarDndApi = createSidebarDndApi({
        state,
        store,
        messengerList,
        moveMessengerToFolder
    })

    const {
        initDrag,
        initDropTarget,
        initRootDropZone,
        loadOrder
    } = sidebarDndApi

    // ==============================
    // PROXY API
    // ==============================
    let openSettingsRef = null

    const proxyApi = createProxyApi({
        store,
        invokeIpc,
        tGet,
        openSettings: () => {
            if (typeof openSettingsRef === 'function') openSettingsRef()
        }
    })

    const {
        initProxySection,
        updateGlobalProxyBtn,
        bind: bindProxy,
        applySavedProxyOnStart,
        openProxyModal
    } = proxyApi

    // ==============================
    // SETTINGS UI API
    // ==============================
    const settingsUiApi = createSettingsUiApi({
        store,
        invokeIpc,
        tGet,
        updateDownloadDirUI,
        initProxySection,
        initSoundPicker,
        applyFoldersEnabled,
        resetPinSetup,
        setActivePinBlock
    })

    const {
        applySettings,
        collectSettings,
        openSettings,
        initSettings
    } = settingsUiApi

    openSettingsRef = openSettings

    // ==============================
    // CHANGE ICON UI API
    // ==============================
    const changeIconUiApi = createChangeIconUiApi({
        state,
        applyI18n
    })

    const {
        openChangeIconModal,
        updateChangeIconPreview,
        readIconFile
    } = changeIconUiApi

    // ==============================
    // MESSENGER SOUND UI API
    // ==============================
    const messengerSoundUiApi = createMessengerSoundUiApi({ requirePro })
    const { openMessengerSoundModal } = messengerSoundUiApi

    // ==============================
    // ЗАГРУЗКА ДАННЫХ
    // ==============================
    async function loadData() {
        const postLoginReload = sessionStorage.getItem('_centrio_post_login_reload')
        if (postLoginReload) {
            sessionStorage.removeItem('_centrio_post_login_reload')
            // Данные уже записаны в store до перезагрузки — пропускаем cloud pull
        } else if (cloudStore.isLoggedIn()) {
            try {
                const cloudData = await cloudSyncPull()

                if (cloudData?.messengers?.length > 0) {
                    store.set('messengers', cloudData.messengers.map(m => ({
                        id: m.id,
                        name: m.name,
                        url: m.url,
                        icon: m.icon || null,
                        color: m.color || null,
                        folderId: m.folderId || null,
                        notifSound: m.notifSound || '__default__',
                        zoomLevel: typeof m.zoomLevel === 'number' ? m.zoomLevel : 1
                    })))

                    store.set('folders', cloudData.folders || [])

                    if (cloudData.settings) {
                        const currentSettings = store.get('settings', {}) || {}
                        const { extra, ...baseSettings } = cloudData.settings
                        store.set('settings', { ...currentSettings, ...baseSettings })
                        // Restore extra settings (PIN, zoom, last active tab)
                        if (extra) {
                            if (extra.pinEnabled  !== undefined) store.set('pinEnabled', extra.pinEnabled)
                            if (extra.pinHash     !== undefined) store.set('pinHash', extra.pinHash)
                            if (extra.lockOnStartup !== undefined) store.set('lockOnStartup', extra.lockOnStartup)
                            if (extra.tabZoomLevel !== undefined) {
                                const s = store.get('settings', {}) || {}
                                store.set('settings', { ...s, tabZoomLevel: extra.tabZoomLevel })
                            }
                        }
                    }

                    const muted = {}
                    cloudData.messengers.forEach(m => {
                        if (m.isMuted) muted[m.id] = true
                    })
                    store.set('mutedMessengers', muted)
                }
            } catch (error) {
                console.error('Cloud load error:', error)
            }
        }

        const savedMessengers = await store.getAsync('messengers', [])
        const savedFolders = await store.getAsync('folders', [])
        state.mutedMessengers = await store.getAsync('mutedMessengers', {})
        state.globalMuteAll = await store.getAsync('globalMuteAll', false)
        state.folders = savedFolders || []

        updateMuteAllBtn()

        if (savedMessengers.length === 0 && savedFolders.length === 0) {
            welcomeScreen.style.display = 'flex'
            tabsContent.style.pointerEvents = 'none'
            updateStatusBar()
            return
        }

        welcomeScreen.style.display = 'none'
        tabsContent.style.pointerEvents = 'auto'

        state.folders.forEach(renderFolder)

        const settings = await store.getAsync('settings', {})
        const foldersEnabled = settings?.foldersEnabled !== false
        if (!foldersEnabled) setTimeout(() => applyFoldersEnabled(false), 100)

        savedMessengers.forEach(messenger => {
            const normalizedMessenger = {
                ...messenger,
                zoomLevel: typeof messenger.zoomLevel === 'number'
                    ? messenger.zoomLevel
                    : (store.get('tabZoomLevel', 1) || 1)
            }

            state.activeMessengers.push(normalizedMessenger)

            if (normalizedMessenger.folderId) addToFolder(normalizedMessenger, normalizedMessenger.folderId)
            else addToSidebar(normalizedMessenger)

            addTab(normalizedMessenger)
            addWebview(normalizedMessenger)
        })

        if (savedMessengers.length > 0) {
            const savedSettings = store.get('settings', {}) || {}
            const lastActiveId = savedSettings.extra?.activeTabId
            const tabToOpen = lastActiveId && savedMessengers.find(m => m.id === lastActiveId)
                ? lastActiveId
                : savedMessengers[0].id
            switchTab(tabToOpen)
        }

        loadOrder()
        initRootDropZone()

        state.activeMessengers.forEach(m => {
            state.rawUnreadCounts[m.id] = 0
            state.unreadCounts[m.id] = 0
            resetMessengerNotifyState(m.id, 0)
        })

        updateStatusBar()
    }

    // ==============================
    // ПРИВЯЗКА UI / EVENTS
    // ==============================
    downloadsApi.bind()
    bindProxy()
    searchUiApi.bind()
    bindWebviewContextMenuActions()

    bindSettingsUi({
        store,
        ipcRenderer,
        tGet,
        openSettings,
        collectSettings,
        applySettings,
        resetPinSetup,
        setActivePinBlock,
        openPinDisableModal,
        updateLockBtn,
        requirePro,
        openExtensionsSection: extensionsUiApi.openExtensionsSection
    })

    bindLockUi({
        state,
        store,
        isPasswordEnabled,
        showLockScreen,
        updateLockDots,
        tryUnlock,
        showForgotPinConfirm,
        handlePinInput,
        setActivePinBlock,
        savePinClick,
        resetPinSetup,
        updateSetPinDots,
        updateDisableDots,
        tryDisablePin,
        closePinDisableModal
    })

    bindChangeIconUi({
        state,
        saveData,
        hideAllMenus,
        openChangeIconModal,
        updateChangeIconPreview,
        readIconFile,
        getMessengerById: (id) => state.activeMessengers.find(m => m.id === id)
    })

    bindMessengerSoundUi({
        state,
        saveData,
        hideAllMenus,
        previewMessengerSound,
        openMessengerSoundModal,
        getMessengerById: (id) => state.activeMessengers.find(m => m.id === id)
    })

    bindCloudUi({
        cloudStore,
        cloudApi,
        cloudSyncPush,
        cloudSyncAfterLogin,
        tGet,
        openCloudLogin,
        openCloudProfile,
        updateAvatarInModal,
        renderLocalStats,
        openUrl: (url) => window.electronAPI?.openExternal?.(url)
    })

    // Кнопка "Войти в аккаунт" на приветственном экране
    document.getElementById('welcomeLoginBtn')?.addEventListener('click', () => {
        if (cloudStore.isLoggedIn()) openCloudProfile()
        else openCloudLogin()
    })

    bindMenuUi({
        state,
        store,
        ipcRenderer,
        menuToggleBtn,
        applyMenuCollapsed,
        applyAppZoom,
        applyTabZoom,
        openSettings
    })

    bindWindowUi({
        store,
        state,
        ipcRenderer,
        switchTab,
        showLockScreen,
        openSettings
    })

    bindAppEvents({
        state,
        quickSearch,
        findBar,
        closeQuickSearch,
        openQuickSearch,
        closeFindBar,
        openFindBar,
        switchTab,
        applyAppZoom,
        applyTabZoom,
        openSettings
    })

    bindEditModalUi({
        state,
        editModal,
        folderIcons,
        saveData,
        moveMessengerToFolder,
        renderFolder,
        addToSidebar,
        getFolderById: (id) => state.folders.find(f => f.id === id),
        getMessengerById: (id) => state.activeMessengers.find(m => m.id === id)
    })

    bindAddModalUi({
        state,
        PAGE_SIZE,
        popularMessengers,
        addModal,
        closeModal,
        openModal,
        fillMessengerGrid,
        addMessenger,
        requirePro,
        tGet
    })

    function updateVpnBadge(messengerId, enabled) {
        const item = document.getElementById(`sidebar-${messengerId}`)
        if (!item) return
        const wrap = item.querySelector('.messenger-icon-wrap')
        if (!wrap) return
        const existing = wrap.querySelector('.vpn-badge')
        if (enabled && !existing) {
            const badge = document.createElement('span')
            badge.className = 'vpn-badge'
            badge.title = 'VPN включён'
            badge.textContent = '🛡'
            wrap.appendChild(badge)
        } else if (!enabled && existing) {
            existing.remove()
        }
    }

    // VPN toggle для конкретного мессенджера из контекстного меню
    async function toggleMessengerVpn (messengerId) {
        const modesResult = await invokeIpc('vpn-get-app-modes').catch(() => ({ modes: {} }))
        const modes = modesResult?.modes || {}
        const current = modes[messengerId] !== false
        const newEnabled = !current
        await invokeIpc('vpn-set-app-vpn', messengerId, newEnabled).catch(() => null)
        updateVpnBadge(messengerId, newEnabled)
    }

    // При открытии контекстного меню обновляем label VPN-пункта
    document.addEventListener('contextmenu-opened', async () => {
        const id = state.contextTargetId
        if (!id) return
        const modesResult = await invokeIpc('vpn-get-app-modes').catch(() => ({ modes: {} }))
        const modes = modesResult?.modes || {}
        const enabled = modes[id] !== false
        const label = document.getElementById('ctxVpnLabel')
        if (label) label.textContent = tGet(enabled ? 'network.vpnCtx' : 'network.vpnCtxDisable')
    })

    bindContextActionsUi({
        state,
        folderIcons,
        saveData,
        hideAllMenus,
        openEditModal: () => {
            editModal.classList.add('show')
            const iconPickerWrap = document.getElementById('iconPickerWrap')
            const iconPicker = document.getElementById('iconPicker')
            const isFolder = state.editMode === 'folder' || state.editMode === 'newFolder'
            if (iconPickerWrap) iconPickerWrap.style.display = isFolder ? 'block' : 'none'
            if (isFolder && iconPicker && !iconPicker.dataset.inited) {
                iconPicker.dataset.inited = '1'
                iconPicker.innerHTML = ''
                Object.entries(folderIcons).forEach(([key, svg]) => {
                    const item = document.createElement('div')
                    item.className = 'icon-picker-item'
                    item.dataset.icon = key
                    item.innerHTML = svg
                    item.addEventListener('click', () => {
                        iconPicker.querySelectorAll('.icon-picker-item').forEach(el => el.classList.remove('selected'))
                        item.classList.add('selected')
                        state.selectedFolderIcon = key
                    })
                    iconPicker.appendChild(item)
                })
            }
            if (isFolder && iconPicker) {
                iconPicker.querySelectorAll('.icon-picker-item').forEach(el => {
                    el.classList.toggle('selected', el.dataset.icon === (state.selectedFolderIcon || 'folder'))
                })
            }
        },
        toggleMessengerVpn,
        removeMessenger,
        moveMessengerToFolder,
        removeFolder,
        updateMuteIcon,
        getMessengerById: (id) => state.activeMessengers.find(m => m.id === id),
        getFolderById: (id) => state.folders.find(f => f.id === id),
        requirePro,
        tGet
    })

    bindSidebarShellUi({
        state,
        hideAllMenus,
        closeFolderPanel,
        toggleMuteAll,
        updateUnreadCount,
        updateMuteIcon,
        getActiveMessengers: () => state.activeMessengers,
        getRawUnreadCount: (id) => state.rawUnreadCounts[id] || 0,
        sidebarContextMenu,
        tGet
    })

    const appNotifApi = bindAppNotifUi({
        cloudStore,
        invokeIpc,
        authorizedInvoke,
        tGet,
        state,
        toggleMuteAll
    })
    if (appNotifApi?.addMessengerNotification) {
        addMessengerNotifRef = appNotifApi.addMessengerNotification
    }

    bindVpnUi({ invokeIpc, tGet, state })
    bindVpnSettings({ invokeIpc, tGet, getActiveMessengers: () => state.activeMessengers })

    bindUpdater({
        ipcRenderer,
        invokeIpc,
        showUpdateBanner,
        tGet
    })

    await advanceStartup('bindings', 68, { minStepTime: 280 })

    // ==============================
    // ПЕРВИЧНЫЙ ЗАПУСК
    // ==============================
    applySavedProxyOnStart()
    applyMenuCollapsed()

    if (state.appZoomLevel !== 0) {
        if (window.electronAPI?.setAppZoom) {
            window.electronAPI.setAppZoom(state.appZoomLevel)
        } else {
            ipcRenderer.send('set-app-zoom', state.appZoomLevel)
        }
    }

    setInterval(() => {
        if (cloudStore.isLoggedIn()) cloudSyncPush()
    }, 5 * 60 * 1000)

    // ── Periodic tracker heartbeat: flush current tab's time ──────
    setInterval(() => {
        if (_tkPrevId && _tkPrevName && _tkStart > 0) {
            const secs = Math.floor((Date.now() - _tkStart) / 1000)
            if (secs > 0) {
                invokeIpc('tracker:service-time', { service: _tkPrevName, serviceTime: secs })
                    .catch(() => {})
                _tkStart = Date.now() // reset so we don't double-count
            }
        }
    }, 5 * 60 * 1000)

    setInterval(updateStatusBar, 30000)
      await advanceStartup('data', 82, { minStepTime: 300 })
    try {
        await loadData()
    } catch (err) {
        console.error(err)
    }

    // Обновляем уведомления после полной загрузки (на случай если при init токена ещё не было)
    if (cloudStore.isLoggedIn()) {
        appNotifApi?.fetchNotifications?.()
    }

    await advanceStartup('security', 94, { minStepTime: 260 })

    const appVersionText = document.getElementById('appVersionText')
    const statusVersionEl = document.getElementById('statusVersion')
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn')
    const updateStatusBadge = document.getElementById('updateStatusBadge')

    if (window.electronAPI?.getAppVersion) {
        try {
            const version = await window.electronAPI.getAppVersion()
            if (appVersionText) appVersionText.textContent = `v${version}`
            if (statusVersionEl) statusVersionEl.textContent = `v${version}`
        } catch (error) {
            console.error('Не удалось получить версию приложения:', error)
        }
    }

    // ── Попап-календарь при клике на дату в статусбаре ──────────────
    ;(function initCalendarPopup() {
        const dateBtn = document.getElementById('statusDate')
        const popup   = document.getElementById('calendarPopup')
        if (!dateBtn || !popup) return

        let calYear  = new Date().getFullYear()
        let calMonth = new Date().getMonth()

        const MONTH_NAMES = [
            'Январь','Февраль','Март','Апрель','Май','Июнь',
            'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
        ]

        function renderCalendar() {
            const label = document.getElementById('calMonthLabel')
            const grid  = document.getElementById('calGrid')
            if (!label || !grid) return

            label.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`
            grid.innerHTML = ''

            const today     = new Date()
            const firstDay  = new Date(calYear, calMonth, 1)
            // Monday-first: getDay() returns 0=Sun, shift so Mon=0
            let startOffset = (firstDay.getDay() + 6) % 7
            const daysInMonth   = new Date(calYear, calMonth + 1, 0).getDate()
            const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate()

            // Prev month fill
            for (let i = startOffset - 1; i >= 0; i--) {
                const d = document.createElement('div')
                d.className = 'cal-day other-month'
                d.textContent = daysInPrevMonth - i
                grid.appendChild(d)
            }
            // Current month
            for (let day = 1; day <= daysInMonth; day++) {
                const d = document.createElement('div')
                const dow = (new Date(calYear, calMonth, day).getDay() + 6) % 7 // 5=Sat,6=Sun
                d.className = 'cal-day' +
                    (dow >= 5 ? ' weekend' : '') +
                    (day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear() ? ' today' : '')
                d.textContent = day
                grid.appendChild(d)
            }
            // Next month fill
            const totalCells = startOffset + daysInMonth
            const remain = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
            for (let i = 1; i <= remain; i++) {
                const d = document.createElement('div')
                d.className = 'cal-day other-month'
                d.textContent = i
                grid.appendChild(d)
            }
        }

        document.getElementById('calPrevBtn')?.addEventListener('click', (e) => {
            e.stopPropagation()
            calMonth--; if (calMonth < 0) { calMonth = 11; calYear-- }
            renderCalendar()
        })
        document.getElementById('calNextBtn')?.addEventListener('click', (e) => {
            e.stopPropagation()
            calMonth++; if (calMonth > 11) { calMonth = 0; calYear++ }
            renderCalendar()
        })

        dateBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            const visible = popup.style.display !== 'none'
            if (!visible) {
                calYear = new Date().getFullYear()
                calMonth = new Date().getMonth()
                renderCalendar()
                const rect = dateBtn.getBoundingClientRect()
                popup.style.bottom  = (window.innerHeight - rect.top + 6) + 'px'
                popup.style.left    = Math.min(rect.left, window.innerWidth - 270) + 'px'
                popup.style.display = 'block'
            } else {
                popup.style.display = 'none'
            }
        })

        document.addEventListener('click', (e) => {
            if (popup.style.display !== 'none' && !popup.contains(e.target) && e.target !== dateBtn) {
                popup.style.display = 'none'
            }
        })
    })()

    // ── Попап changelog при клике на версию в статусбаре ────────────
    ;(function initVersionPopup() {
        const versionBtn  = document.getElementById('statusVersion')
        const popup       = document.getElementById('changelogPopup')
        const closeBtn    = document.getElementById('changelogPopupClose')
        if (!versionBtn || !popup) return

        function showPopup () { popup.style.display = 'flex' }
        function hidePopup () { popup.style.display = 'none' }
        function isVisible () { return popup.style.display !== 'none' }

        versionBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            isVisible() ? hidePopup() : showPopup()
        })

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                hidePopup()
            })
        }

        document.addEventListener('click', (e) => {
            if (isVisible() && !popup.contains(e.target) && e.target !== versionBtn) {
                hidePopup()
            }
        })
    })()

    if (checkUpdatesBtn && updateStatusBadge && window.electronAPI?.checkForUpdates) {
        checkUpdatesBtn.addEventListener('click', async () => {
            updateStatusBadge.textContent = 'Проверка обновлений...'
            checkUpdatesBtn.disabled = true

            try {
                const result = await window.electronAPI.checkForUpdates()

                if (result?.success) {
                    if (result.updateInfo) {
                        updateStatusBadge.textContent = 'Проверка выполнена'
                    } else {
                        updateStatusBadge.textContent = 'У вас актуальная версия'
                    }
                } else {
                    updateStatusBadge.textContent = 'Ошибка проверки'
                    console.error('Ошибка обновления:', result?.error)
                }
            } catch (error) {
                updateStatusBadge.textContent = 'Ошибка проверки'
                console.error(error)
            } finally {
                checkUpdatesBtn.disabled = false
            }
        })
    }

    initSettings()
    applyI18n()
    updateCloudBtn()
    updateLockBtn()
    initProxySection()
    updateGlobalProxyBtn()
    console.log('[bootstrap] security =', store.get('security', {}))
console.log('[bootstrap] pinEnabled =', store.get('pinEnabled', false))
console.log('[bootstrap] pinHash exists =', !!store.get('pinHash', ''))
console.log('[bootstrap] isPasswordEnabled typeof =', typeof isPasswordEnabled)
try {
    console.log('[bootstrap] isPasswordEnabled() =', isPasswordEnabled?.())
} catch (e) {
    console.error('[bootstrap] isPasswordEnabled failed', e)
}

    const shouldLockOnStart = isPasswordEnabled()

    if (shouldLockOnStart) {
        await advanceStartup('security', 100, { minStepTime: 260 })
        showAppRoot()
        showLockScreen()
        document.body.classList.add('startup-locked')

        setTimeout(() => {
            hideStartupSplash()
        }, 120)

        return
    }

    await advanceStartup('done', 100, { minStepTime: 240 })

    setTimeout(() => {
        finishStartup({ locked: false })
    }, 120)
}

// ==============================
// ЗАПУСК BOOTSTRAP
// ==============================
bootstrap().catch((err) => {
    console.error('Renderer bootstrap error:', err)

    const appRoot = document.getElementById('appRoot')
    const splash = document.getElementById('startupSplash')
    const stageText = document.getElementById('startupStageText')
    const hintText = document.getElementById('startupHintText')

    if (stageText) {
        stageText.textContent = 'Ошибка запуска'
    }

    if (hintText) {
        hintText.textContent = 'Произошла ошибка при инициализации. Открываем интерфейс...'
    }

    setStartupProgress(100)

    setTimeout(() => {
        if (appRoot) {
            appRoot.classList.remove('app-root-hidden')
            appRoot.classList.add('app-root-ready')
        }

        if (splash) {
            splash.classList.add('hidden')
        }
    }, 500)
})

window.showConfirmModal = function ({
  title = 'Подтверждение',
  message = 'Вы уверены?',
  confirmText = 'OK',
  cancelText = 'Отмена',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const closeBtn = document.getElementById('confirmCloseBtn');

    if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn || !closeBtn) {
      resolve(false);
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    okBtn.classList.remove('vsc-btn', 'vsc-btn-danger');
    okBtn.classList.add(danger ? 'vsc-btn-danger' : 'vsc-btn');

    let done = false;

    const cleanup = () => {
      modal.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('mousedown', onOverlayClick);
      document.removeEventListener('keydown', onKeyDown);
    };

    const finish = (value) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(value);
    };

    const onOk = () => finish(true);
    const onCancel = () => finish(false);

    const onOverlayClick = (e) => {
      if (e.target === modal) {
        finish(false);
      }
    };

    const onKeyDown = (e) => {
      if (!modal.classList.contains('show')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    modal.addEventListener('mousedown', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);

    modal.classList.add('show');
    okBtn.focus();
  });
};