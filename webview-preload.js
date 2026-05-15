const { ipcRenderer } = require('electron')

let lastSentCount = -1
let zeroStreak = 0
let unreadInterval = null
let mutationObserver = null

function getHostname() {
    try {
        return window.location.hostname || ''
    } catch {
        return ''
    }
}

function parsePositiveInt(value) {
    if (value == null) return null

    const text = String(value).trim()
    if (!text) return null

    const match = text.match(/\d+/)
    if (!match) return null

    const num = parseInt(match[0], 10)
    if (!Number.isFinite(num) || num < 0 || num >= 10000) return null

    return num
}

function isElementVisible(el) {
    if (!el || !(el instanceof Element)) return false

    const style = window.getComputedStyle(el)
    if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0'
    ) {
        return false
    }

    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
}

function extractUnreadFromTitle(title) {
    if (!title) return null

    let match = title.match(/^\((\d+)\)\s*/)
    if (match) return parseInt(match[1], 10) || 0

    match = title.match(/\((\d+)\)\s*$/)
    if (match) return parseInt(match[1], 10) || 0

    match = title.match(/^(\d+)\b/)
    if (match) return parseInt(match[1], 10) || 0

    return null
}

function extractUnreadTelegram() {
    const selectors = [
        '[aria-label*="unread"]',
        '[aria-label*="Unread"]',
        '.ListItem-badge',
        '.badge',
        '.Badge',
        '.counter',
        '.Counter'
    ]

    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector)

        for (const el of elements) {
            if (!isElementVisible(el)) continue

            const aria = el.getAttribute('aria-label')
            const ariaNum = parsePositiveInt(aria)
            if (typeof ariaNum === 'number' && ariaNum > 0) return ariaNum

            const text = (el.textContent || '').trim()
            if (text.length > 6) continue

            const num = parsePositiveInt(text)
            if (typeof num === 'number' && num > 0) return num
        }
    }

    return null
}

function extractUnreadGeneric() {
    const selectors = [
        '.unread-count',
        '.badge-counter',
        '.chat-unread-count',
        '.conversations-badge',
        '[aria-label*="unread"]',
        '[aria-label*="Unread"]'
    ]

    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector)

        for (const el of elements) {
            if (!isElementVisible(el)) continue

            const aria = el.getAttribute('aria-label')
            const ariaNum = parsePositiveInt(aria)
            if (typeof ariaNum === 'number' && ariaNum > 0) return ariaNum

            const text = (el.textContent || '').trim()
            if (text.length > 6) continue

            const num = parsePositiveInt(text)
            if (typeof num === 'number' && num > 0) return num
        }
    }

    return null
}

function extractUnreadCount() {
    const hostname = getHostname()
    const title = document.title || ''

    const titleCount = extractUnreadFromTitle(title)
    if (typeof titleCount === 'number' && titleCount > 0) return titleCount

    let domCount = null

    if (hostname.includes('telegram')) {
        domCount = extractUnreadTelegram()
    } else {
        domCount = extractUnreadGeneric()
    }

    if (typeof domCount === 'number' && domCount > 0) return domCount

    if (typeof titleCount === 'number') return titleCount

    return 0
}

function checkUnread() {
    try {
        const count = extractUnreadCount()

        if (count > 0) {
            zeroStreak = 0

            if (count !== lastSentCount) {
                lastSentCount = count
                ipcRenderer.sendToHost('unread-count', count)
            }
            return
        }

        zeroStreak += 1

        if (zeroStreak < 3) return

        if (lastSentCount !== 0) {
            lastSentCount = 0
            ipcRenderer.sendToHost('unread-count', 0)
        }
    } catch {
        // ignore
    }
}

function startUnreadInterval() {
    if (unreadInterval) clearInterval(unreadInterval)
    unreadInterval = setInterval(checkUnread, 5000)
}

function startObserver() {
    const target = document.documentElement || document.body
    if (!target) {
        setTimeout(startObserver, 500)
        return
    }

    let debounceTimer = null

    mutationObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(checkUnread, 300)
    })

    mutationObserver.observe(target, {
        childList: true,
        subtree: true,
        characterData: false,
        attributes: true
    })
}

function bindContextMenuForwarding() {
    // Первый ПКМ — показываем браузерное меню.
    // Второй ПКМ в течение 600 мс — показываем наше кастомное меню.
    // ИЛИ Ctrl + ПКМ — сразу показываем браузерное меню (всегда).
    let lastRightClickTime = 0
    const DOUBLE_CLICK_THRESHOLD = 600  // мс

    document.addEventListener('contextmenu', (e) => {
        const now = Date.now()
        const timeSinceLast = now - lastRightClickTime
        lastRightClickTime = now

        // Ctrl+ПКМ или двойной ПКМ — показываем наше кастомное меню
        const showCustomMenu = e.ctrlKey || timeSinceLast <= DOUBLE_CLICK_THRESHOLD

        if (!showCustomMenu) {
            // Первый клик без Ctrl — позволяем браузеру показать своё меню
            return
        }

        e.preventDefault()
        e.stopPropagation()

        const target = e.target
        const link = target?.closest?.('a')?.href || ''
        const isImage = target?.tagName === 'IMG'
        const selectionText = window.getSelection?.()?.toString?.() || ''

        ipcRenderer.sendToHost('context-menu', {
            x: e.x,
            y: e.y,
            clientX: e.clientX,
            clientY: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
            screenX: e.screenX,
            screenY: e.screenY,
            mediaType: isImage ? 'image' : 'none',
            srcURL: isImage ? (target.src || '') : '',
            linkURL: link,
            selectionText
        })
    })

    document.addEventListener('click', () => {
        ipcRenderer.sendToHost('close-context-menu', {})
    })
}

function bindDownloadImageHandler() {
    ipcRenderer.on('download-image', async (_event, url) => {
        try {
            let dataUrl = ''

            if (url.startsWith('blob:')) {
                const response = await fetch(url)
                const blob = await response.blob()
                dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result)
                    reader.readAsDataURL(blob)
                })
            } else if (url.startsWith('data:')) {
                dataUrl = url
            } else {
                const response = await fetch(url, { credentials: 'include' })
                const blob = await response.blob()
                dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result)
                    reader.readAsDataURL(blob)
                })
            }

            ipcRenderer.sendToHost('image-data', dataUrl)
        } catch {
            ipcRenderer.sendToHost('image-data', null)
        }
    })
}

function bindLinkInterception() {
    document.addEventListener('click', (e) => {
        const link = e.target?.closest && e.target.closest('a[href]')
        if (!link) return

        const href = link.getAttribute('href')
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

        if (
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            link.target === '_blank'
        ) {
            e.preventDefault()
            e.stopPropagation()
            ipcRenderer.send('open-url', href)
        }
    }, true)

    const originalOpen = window.open
    window.open = function patchedOpen(url, ...args) {
        if (url && url !== 'about:blank') {
            ipcRenderer.send('open-url', url)
            return null
        }

        if (typeof originalOpen === 'function') {
            return originalOpen.call(window, url, ...args)
        }

        return null
    }
}

// ─── Перехват Notification ──────────────────────────────────────────────────
// Вызываем ДО DOMContentLoaded (до того как страница успеет сохранить
// оригинальный Notification). Так ловим даже ранние вызовы.
function patchNotification() {
    const OriginalNotification = window.Notification
    if (!OriginalNotification || window.__centrioNotifPatched) return
    window.__centrioNotifPatched = true

    function sendNotif(title, options) {
        try {
            ipcRenderer.sendToHost('site-notification', {
                title: String(title || ''),
                body: String(options?.body || ''),
                tag: String(options?.tag || ''),
                icon: options?.icon || ''
            })
        } catch {}
    }

    class PatchedNotification extends OriginalNotification {
        constructor(title, options = {}) {
            sendNotif(title, options)
            super(title, options)
            this.addEventListener('click', () => {
                try { ipcRenderer.sendToHost('notification-clicked', {}) } catch {}
            })
        }
    }

    try {
        Object.defineProperty(PatchedNotification, 'permission', {
            get() { return OriginalNotification.permission }
        })
    } catch {
        PatchedNotification.permission = OriginalNotification.permission
    }

    PatchedNotification.requestPermission =
        OriginalNotification.requestPermission?.bind(OriginalNotification)
        ?? (() => Promise.resolve('granted'))

    window.Notification = PatchedNotification

    // ── Перехват ServiceWorker registration.showNotification ──────────────
    // Telegram, WhatsApp и другие показывают уведомления через service worker,
    // а не через window.Notification — нужен отдельный перехват.
    try {
        const origRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker)
        navigator.serviceWorker.register = async function (scriptURL, options) {
            const reg = await origRegister(scriptURL, options)
            patchSwRegistration(reg)
            return reg
        }
    } catch {}

    // Также патчим уже существующую registration, если она есть
    try {
        navigator.serviceWorker.ready.then(reg => patchSwRegistration(reg)).catch(() => {})
    } catch {}

    function patchSwRegistration(reg) {
        if (!reg || reg.__centrioPatched) return
        reg.__centrioPatched = true
        const origShow = reg.showNotification.bind(reg)
        reg.showNotification = function (title, options) {
            sendNotif(title, options)
            return origShow(title, options)
        }
    }
}

function bindKeyboardForwarding() {
    // Перехватываем горячие клавиши до того, как сайт их обработает,
    // и передаём в главный рендерер (который не получает keydown из webview)
    document.addEventListener('keydown', (e) => {
        if (!e.ctrlKey) return

        let shortcut = null

        if (!e.shiftKey && !e.altKey && e.code >= 'Digit1' && e.code <= 'Digit9') {
            shortcut = `ctrl+${e.code.replace('Digit', '')}`
        } else if (!e.shiftKey && e.code === 'Tab') {
            shortcut = 'ctrl+tab'
            e.preventDefault()
        } else if (e.shiftKey && e.code === 'Tab') {
            shortcut = 'ctrl+shift+tab'
            e.preventDefault()
        } else if (!e.shiftKey && e.code === 'KeyR') {
            shortcut = 'ctrl+r'
        } else if (!e.shiftKey && e.code === 'KeyF') {
            shortcut = 'ctrl+f'
        } else if (!e.shiftKey && (e.code === 'KeyP' || e.code === 'KeyK')) {
            shortcut = 'ctrl+search'
        } else if (!e.shiftKey && e.code === 'Comma') {
            shortcut = 'ctrl+comma'
        }

        if (shortcut) {
            ipcRenderer.sendToHost('keyboard-shortcut', shortcut)
        }
    }, true)
}

function bindMsgSentDetection() {
    // Detect Enter keypress in text input areas → report message sent
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return
        const el = e.target
        if (!el) return
        const tag = el.tagName
        const isInput = tag === 'TEXTAREA' ||
            (tag === 'DIV' && el.contentEditable === 'true') ||
            (tag === 'P'   && el.contentEditable === 'true') ||
            (tag === 'SPAN' && el.contentEditable === 'true')
        if (!isInput) return
        // Small delay so the message actually gets sent before we report
        setTimeout(() => {
            try { ipcRenderer.sendToHost('msg-sent', {}) } catch {}
        }, 100)
    }, true)
}

function init() {
    bindContextMenuForwarding()
    bindKeyboardForwarding()
    bindDownloadImageHandler()
    bindLinkInterception()
    bindMsgSentDetection()
    startObserver()
    startUnreadInterval()
    setTimeout(checkUnread, 1000)
}

// Патчим Notification НЕМЕДЛЕННО — до любых скриптов страницы
patchNotification()

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
    init()
}

window.addEventListener('beforeunload', () => {
    try {
        if (unreadInterval) clearInterval(unreadInterval)
        if (mutationObserver) mutationObserver.disconnect()
    } catch {}
})

console.log('Centrio webview preload: started')