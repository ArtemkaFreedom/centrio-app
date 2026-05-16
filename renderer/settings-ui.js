const { setCurrentLanguage, getCurrentLanguage } = require('./i18n')

// ── Adaptive Theme ────────────────────────────────────────────────────────────
let _adaptiveActive = false
let _adaptiveTimer  = null

function _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2
    if (max === min) { h = s = 0 }
    else {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
            case g: h = ((b - r) / d + 2) / 6; break
            case b: h = ((r - g) / d + 4) / 6; break
        }
    }
    return [h * 360, s * 100, l * 100]
}

function _applyAdaptiveColor({ r, g, b }) {
    // Если цвет слишком тёмный — используем нейтральный синий
    if (r + g + b < 30) { r = 28; g = 34; b = 80 }
    const [h, s] = _rgbToHsl(r, g, b)
    const sat = Math.max(18, Math.min(s, 55))
    const root = document.documentElement
    root.style.setProperty('--bg-primary',   `hsl(${h},${sat}%,8%)`)
    root.style.setProperty('--bg-secondary', `hsl(${h},${Math.min(sat,45)}%,11%)`)
    root.style.setProperty('--bg-tertiary',  `hsl(${h},${Math.min(sat,40)}%,14%)`)
    root.style.setProperty('--bg-hover',     `hsl(${h},${Math.min(sat,38)}%,16%)`)
    root.style.setProperty('--bg-active',    `hsl(${h},${Math.min(sat,42)}%,19%)`)
    root.style.setProperty('--sidebar-bg',   `hsl(${h},${sat}%,12%)`)
    root.style.setProperty('--titlebar-bg',  `hsl(${h},${Math.min(sat,48)}%,10%)`)
    root.style.setProperty('--statusbar-bg', `hsl(${h},${Math.min(sat,50)}%,7%)`)
    root.style.setProperty('--border',       `hsl(${h},${Math.min(sat,30)}%,22%)`)
    root.style.setProperty('--border-light', `hsl(${h},${Math.min(sat,25)}%,18%)`)
    root.style.setProperty('--accent',       `hsl(${h},70%,65%)`)
    root.style.setProperty('--accent-hover', `hsl(${h},70%,70%)`)
    root.style.setProperty('--accent-dim',   `hsla(${h},70%,65%,0.15)`)
    root.style.setProperty('--accent-glow',  `hsla(${h},70%,65%,0.28)`)
}

function _clearAdaptiveVars() {
    const props = [
        '--bg-primary','--bg-secondary','--bg-tertiary','--bg-hover','--bg-active',
        '--sidebar-bg','--titlebar-bg','--statusbar-bg','--border','--border-light',
        '--accent','--accent-hover','--accent-dim','--accent-glow',
    ]
    const root = document.documentElement
    props.forEach(p => root.style.removeProperty(p))
}

async function _extractWebviewColor(webview) {
    if (!webview || typeof webview.executeJavaScript !== 'function') return null
    try {
        return await webview.executeJavaScript(`
            (function() {
                function parseRgb(s) {
                    const m = s && s.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
                    return m ? [+m[1],+m[2],+m[3]] : null;
                }
                const sels = [
                    '[class*="sidebar"]','[class*="Sidebar"]','[class*="side-bar"]',
                    '[class*="leftPanel"]','[class*="left-panel"]',
                    '[class*="nav-panel"]','[data-testid*="sidebar"]',
                    'aside','[role="navigation"]','nav'
                ];
                for (const s of sels) {
                    const el = document.querySelector(s);
                    if (!el) continue;
                    const bg = getComputedStyle(el).backgroundColor;
                    const rgb = parseRgb(bg);
                    if (rgb && (rgb[0]+rgb[1]+rgb[2]) > 5) return {r:rgb[0],g:rgb[1],b:rgb[2]};
                }
                const body = parseRgb(getComputedStyle(document.body).backgroundColor);
                return body ? {r:body[0],g:body[1],b:body[2]} : null;
            })()
        `)
    } catch {
        return null
    }
}

async function updateAdaptiveTheme(getActiveWebview) {
    if (!_adaptiveActive) return
    clearTimeout(_adaptiveTimer)
    _adaptiveTimer = setTimeout(async () => {
        const wv = typeof getActiveWebview === 'function' ? getActiveWebview() : null
        if (!wv) return
        const color = await _extractWebviewColor(wv)
        if (color) _applyAdaptiveColor(color)
    }, 800)
}

function createSettingsUiApi({
    store,
    invokeIpc,
    tGet,
    updateDownloadDirUI,
    initProxySection,
    initSoundPicker,
    applyFoldersEnabled,
    resetPinSetup,
    setActivePinBlock
}) {
    function getSettings() {
        return store.get('settings', {}) || {}
    }

    function applySidebarPosition(position) {
        const mainContainer = document.querySelector('.main-container')
        const activityBar = document.querySelector('.activity-bar')
        const contentArea = document.querySelector('.content-area')

        if (!mainContainer || !activityBar || !contentArea) return

        mainContainer.classList.remove('sidebar-left', 'sidebar-right', 'sidebar-top', 'sidebar-bottom')
        mainContainer.classList.add(`sidebar-${position}`)

        if (position === 'right' || position === 'bottom') {
            mainContainer.appendChild(activityBar)
        } else {
            mainContainer.insertBefore(activityBar, contentArea)
        }
    }

    function applyTheme(theme) {
        const root = document.documentElement
        _adaptiveActive = (theme === 'adaptive')
        if (!_adaptiveActive) _clearAdaptiveVars()
        root.setAttribute('data-theme', theme)

        const settings = getSettings()
        if (settings.accentColor && theme !== 'adaptive') {
            root.style.setProperty('--accent', settings.accentColor)
            root.style.setProperty('--accent-hover', settings.accentColor)
        }
    }

    function applySettings(settings = {}) {
        document.body.style.fontSize = `${settings.fontSize || 13}px`

        const folderLabelEl = document.getElementById('folderPanelName')
        const folderPanelLabelWrap = document.querySelector('.folder-panel-label')
        const showLabel = settings.folderLabel !== false

        applyFoldersEnabled(settings.foldersEnabled !== false)

        if (folderLabelEl) folderLabelEl.style.display = showLabel ? 'block' : 'none'
        if (folderPanelLabelWrap) folderPanelLabelWrap.style.display = showLabel ? 'flex' : 'none'

        const tabsBarEl = document.getElementById('tabsBar')
        if (tabsBarEl) {
            const showTabs = settings.showTabs !== false
            tabsBarEl.style.display = showTabs ? 'flex' : 'none'
            document.querySelector('.titlebar')?.classList.toggle('tabs-hidden', !showTabs)
        }

        if (settings.accentColor) {
            const root = document.documentElement
            root.style.setProperty('--accent', settings.accentColor)
            root.style.setProperty('--accent-hover', `${settings.accentColor}dd`)
            root.style.setProperty('--accent-dim', `${settings.accentColor}20`)
            root.style.setProperty('--accent-glow', `${settings.accentColor}40`)
        }

        document.documentElement.setAttribute('data-density', settings.density || 'comfortable')
        applyTheme(settings.theme || 'dark')
        applySidebarPosition(settings.sidebarPosition || 'left')

        if (settings.language) {
            setCurrentLanguage(settings.language)
        }
    }

    function collectSettings() {
        const currentSettings = getSettings()

        return {
            ...currentSettings,
            language: document.getElementById('settingLanguage')?.value || currentSettings.language || 'ru',
            closeBehavior: document.getElementById('settingCloseBehavior')?.value || currentSettings.closeBehavior || 'tray',
            startMinimized: document.getElementById('settingStartMinimized')?.checked || false,
            fontSize: document.getElementById('settingFontSize')?.value || currentSettings.fontSize || 13,
            showTabs: document.getElementById('settingShowTabs')?.checked ?? true,
            notifications: document.getElementById('settingNotifications')?.checked ?? true,
            notifSound: document.getElementById('settingNotifSound')?.checked ?? true,
            trayBadge: document.getElementById('settingTrayBadge')?.checked ?? true,
            foldersEnabled: document.getElementById('settingFoldersEnabled')?.checked ?? true,
            folderLabel: document.getElementById('settingFolderLabel')?.checked ?? true,
            theme: document.querySelector('.theme-item.active')?.dataset.theme || currentSettings.theme || 'dark',
            accentColor: document.querySelector('.accent-item.active')?.dataset.color || currentSettings.accentColor || '#7b68ee',
            density: document.querySelector('.density-item.active')?.dataset.density || currentSettings.density || 'comfortable',
            sidebarPosition: document.querySelector('.position-item.active')?.dataset.position || currentSettings.sidebarPosition || 'left',
            downloadDir: currentSettings.downloadDir || '',
            askDownload: document.getElementById('settingAskDownload')?.checked ?? (currentSettings.askDownload ?? true),
            adblockEnabled: document.getElementById('extAdblockToggle')?.checked ?? (currentSettings.adblockEnabled !== false)
        }
    }

    async function openSettings() {
        const modal = document.getElementById('settingsModal')
        if (!modal) return

        modal.classList.add('show')

        const settings = getSettings()

        const settingLanguage = document.getElementById('settingLanguage')
        const settingCloseBehavior = document.getElementById('settingCloseBehavior')
        const settingStartMinimized = document.getElementById('settingStartMinimized')
        const settingFontSize = document.getElementById('settingFontSize')
        const settingShowTabs = document.getElementById('settingShowTabs')
        const settingNotifications = document.getElementById('settingNotifications')
        const settingNotifSound = document.getElementById('settingNotifSound')
        const settingTrayBadge = document.getElementById('settingTrayBadge')
        const settingFoldersEnabled = document.getElementById('settingFoldersEnabled')
        const settingFolderLabel = document.getElementById('settingFolderLabel')

        if (settingLanguage) settingLanguage.value = getCurrentLanguage() || settings.language || 'ru'
        if (settingCloseBehavior) settingCloseBehavior.value = settings.closeBehavior || 'tray'
        if (settingStartMinimized) settingStartMinimized.checked = settings.startMinimized || false
        if (settingFontSize) settingFontSize.value = settings.fontSize || '13'
        if (settingShowTabs) settingShowTabs.checked = settings.showTabs !== false
        if (settingNotifications) settingNotifications.checked = settings.notifications !== false
        if (settingNotifSound) settingNotifSound.checked = settings.notifSound !== false
        if (settingTrayBadge) settingTrayBadge.checked = settings.trayBadge !== false
        if (settingFoldersEnabled) settingFoldersEnabled.checked = settings.foldersEnabled !== false
        if (settingFolderLabel) settingFolderLabel.checked = settings.folderLabel !== false

        const extAdblockToggle = document.getElementById('extAdblockToggle')
        if (extAdblockToggle) extAdblockToggle.checked = settings.adblockEnabled !== false

        document.querySelectorAll('.theme-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.theme === (settings.theme || 'dark'))
        })

        document.querySelectorAll('.accent-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.color === (settings.accentColor || '#7b68ee'))
        })
        const customItem = document.getElementById('accentCustomItem')
        if (customItem && settings.accentColor && !document.querySelector('.accent-item.active')) {
            customItem.classList.add('active', 'has-color')
            customItem.dataset.color = settings.accentColor
            customItem.style.setProperty('--accent-custom-color', settings.accentColor)
        } else if (customItem) {
            customItem.classList.remove('has-color')
        }

        document.querySelectorAll('.density-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.density === (settings.density || 'comfortable'))
        })

        document.querySelectorAll('.position-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.position === (settings.sidebarPosition || 'left'))
        })

        const autoLaunchCheckbox = document.getElementById('settingAutoLaunch')
        if (autoLaunchCheckbox) {
            try {
                const result = await invokeIpc('get-auto-launch')
                autoLaunchCheckbox.checked = result?.success ? !!result.data : false
            } catch {
                autoLaunchCheckbox.checked = false
            }
        }

        const status = document.getElementById('settingsStatus')
        if (status) {
            status.textContent = ''
            status.classList.remove('success')
        }

        const sec = store.get('security', {}) || {}
        const settingPasswordEnable = document.getElementById('settingPasswordEnable')
        const settingLockOnHide = document.getElementById('settingLockOnHide')
        const passwordFields = document.getElementById('passwordFields')

        if (settingPasswordEnable) settingPasswordEnable.checked = !!sec.enabled
        if (settingLockOnHide) settingLockOnHide.checked = !!sec.lockOnHide

        resetPinSetup()

        if (passwordFields) {
            if (sec.enabled) {
                passwordFields.style.display = 'block'
                setTimeout(() => setActivePinBlock('new'), 150)
            } else {
                passwordFields.style.display = 'none'
            }
        }

        const askDownloadCheckbox = document.getElementById('settingAskDownload')
        if (askDownloadCheckbox) {
            askDownloadCheckbox.checked = settings.askDownload ?? true
        }

        updateDownloadDirUI(settings.downloadDir || '')
        initProxySection()
        initSoundPicker()
        initCollapsibles()
    }

    let collapsiblesInited = false
    function initCollapsibles() {
        if (collapsiblesInited) return
        collapsiblesInited = true

        const pairs = [
            ['settingsVpnToggle', 'settingsVpnBody', 'settingsVpnChevron'],
            ['settingsProxyToggle', 'settingsProxyBody', 'settingsProxyChevron']
        ]

        pairs.forEach(([toggleId, bodyId, chevronId]) => {
            const toggle = document.getElementById(toggleId)
            const body = document.getElementById(bodyId)
            const chevron = document.getElementById(chevronId)
            if (!toggle || !body) return

            toggle.addEventListener('click', () => {
                const open = body.style.display !== 'none'
                body.style.display = open ? 'none' : 'block'
                if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)'
            })
        })
    }

    function initSettings() {
        const settings = getSettings()
        applySettings(settings)
    }

    return {
        applySidebarPosition,
        applyTheme,
        applySettings,
        collectSettings,
        openSettings,
        initSettings
    }
}

module.exports = {
    createSettingsUiApi,
    updateAdaptiveTheme,
}