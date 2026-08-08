// ПРИМЕЧАНИЕ: детект непрочитанных сообщений (extractUnreadCount и всё, что
// его вызывает) ниже по факту не исполняется в текущей сборке — диагностика
// подтвердила, что preload-атрибут <webview> на используемой версии Electron
// (39.x) не подключается к гостевой странице вовсе (ни console.log, ни
// созданный им DOM-узел ни разу не появились, хотя main-процесс репортует
// верный путь к файлу). Реальный, рабочий детект теперь в
// main/bootstrap/registerAppEvents.js (startUnreadPolling, через
// contents.executeJavaScript на dom-ready — подтверждённо рабочий канал).
// Код ниже оставлен как есть (не удалён) — начнёт снова работать сам собой,
// если апстрим-баг Electron с preload у <webview> когда-нибудь пофиксят, и
// остальной функционал файла (перехват ссылок, контекстное меню и т.д.)
// может по-прежнему нормально исполняться там, где preload всё же цепляется.

const { ipcRenderer } = require('electron')

let lastSentCount = -1
let zeroStreak = 0
let unreadInterval = null
let mutationObserver = null

// ── Badging API hook (navigator.setAppBadge / clearAppBadge) ───────────────
// Многие современные веб-мессенджеры (WhatsApp Web среди них) ставят бейдж
// непрочитанных через стандартный Web Badging API, а не через DOM/title —
// это АВТОРИТЕТНЫЙ сигнал (сайт сам сообщает точное число), надёжнее любой
// DOM-эвристики выше. Проблема: этот preload-скрипт исполняется в изолированном
// мире (contextIsolation), а страница вызывает navigator.setAppBadge() в своём,
// основном мире — прямая подмена navigator здесь на неё не подействует. Поэтому
// патчим через инжект <script> в сам документ (это уже основной мир) и
// перебрасываем значение обратно через обычное DOM CustomEvent — оно, в отличие
// от JS-объектов, пересекает границу миров штатно.
let badgeApiCount = null

function injectBadgeApiHook() {
    const target = document.head || document.documentElement
    if (!target) {
        setTimeout(injectBadgeApiHook, 50)
        return
    }
    try {
        const script = document.createElement('script')
        script.textContent = `(() => {
            if (!navigator.setAppBadge) return;
            const origSet = navigator.setAppBadge.bind(navigator);
            const origClear = navigator.clearAppBadge ? navigator.clearAppBadge.bind(navigator) : null;
            navigator.setAppBadge = (count) => {
                window.dispatchEvent(new CustomEvent('__centrio_badge', { detail: { count: typeof count === 'number' ? count : 1 } }));
                return origSet(count);
            };
            if (origClear) {
                navigator.clearAppBadge = () => {
                    window.dispatchEvent(new CustomEvent('__centrio_badge', { detail: { count: 0 } }));
                    return origClear();
                };
            }
        })();`
        target.appendChild(script)
        script.remove()
    } catch {
        // ignore — сайт просто не получит этот сигнал, остальные эвристики останутся
    }
}

window.addEventListener('__centrio_badge', (e) => {
    const count = e.detail?.count
    badgeApiCount = Number.isFinite(count) && count >= 0 ? count : null
    checkUnread()
})

injectBadgeApiHook()

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

    // "3 unread messages - App", "(3 unread) App" и т.п.
    match = title.match(/(\d+)\s+unread/i)
    if (match) return parseInt(match[1], 10) || 0

    return null
}

// Общий сборщик по списку селекторов: ищем видимый элемент с числом (из aria-label
// или из текста) — используется и Telegram-, и generic-эвристикой ниже.
function scanSelectorsForCount(selectors) {
    for (const selector of selectors) {
        let elements
        try {
            elements = document.querySelectorAll(selector)
        } catch {
            continue // невалидный селектор (например, движок не поддерживает :has) — пропускаем
        }

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

// ПРИМЕЧАНИЕ по хрупкости: современные веб-мессенджеры (WhatsApp Web, Telegram Web
// и т.п.) часто используют хэшированные CSS-модули (например, "_ak8h"), где точное
// имя класса меняется от сборки к сборке — точные селекторы вроде ".badge" быстро
// устаревают. Поэтому здесь помимо точных легаси-классов используем ЧАСТИЧНОЕ
// регистронезависимое совпадение по [class*=…], [data-testid*=…], [aria-label*=…] —
// это заметно устойчивее к обновлениям вёрстки конкретного сайта.
function extractUnreadTelegram() {
    return scanSelectorsForCount([
        '[aria-label*="unread" i]',
        '.ListItem-badge',
        '.badge',
        '.Badge',
        '.counter',
        '.Counter',
        '[class*="unread" i]',
        '[class*="badge" i]',
        '[data-testid*="unread" i]',
        '[data-testid*="badge" i]'
    ])
}

function extractUnreadGeneric() {
    return scanSelectorsForCount([
        '.unread-count',
        '.badge-counter',
        '.chat-unread-count',
        '.conversations-badge',
        '[aria-label*="unread" i]',
        '[class*="unread" i]',
        '[class*="badge-count" i]',
        '[class*="unreadcount" i]',
        '[data-testid*="unread" i]',
        '[data-testid*="badge" i]'
    ])
}

// ── Резервный сигнал: бейдж на фавиконе ────────────────────────────────────
// Многие веб-клиенты (WhatsApp Web, Slack и др.) рисуют бейдж непрочитанных
// поверх иконки через Canvas и подставляют её в <link rel="icon"> как data:-URI —
// это не зависит от разметки/классов страницы вообще. Берём это как последний
// сигнал "есть непрочитанное" (без точного числа), когда DOM- и title-эвристики
// ничего не нашли. baseline фиксируем один раз спустя паузу после старта, чтобы
// не поймать иконку самого первого рендера как "с бейджем".
let baselineFaviconHref = null
let baselineFaviconAt = 0

function getFaviconHref() {
    const link = document.querySelector('link[rel~="icon"]')
    return (link && link.getAttribute('href')) || ''
}

function captureBaselineFavicon() {
    if (baselineFaviconHref !== null) return
    const href = getFaviconHref()
    // Если уже на старте это data:-иконка — сайт мог отрисовать её до нашего замера,
    // либо вообще не использует этот приём; сравнение будет ненадёжным — не включаем эвристику.
    if (href && !href.startsWith('data:')) {
        baselineFaviconHref = href
        baselineFaviconAt = Date.now()
    }
}

function hasFaviconBadge() {
    if (!baselineFaviconHref) return false
    if (Date.now() - baselineFaviconAt < 3000) return false
    const href = getFaviconHref()
    return !!href && href.startsWith('data:') && href !== baselineFaviconHref
}

function extractUnreadCount() {
    // BUGFIX ("бейджи непрочитанных пропали целиком — были раньше"): раньше
    // badgeApiCount (сигнал от navigator.setAppBadge, см. injectBadgeApiHook
    // выше) был АБСОЛЮТНЫМ приоритетом — если сайт хоть раз вызывал
    // setAppBadge/clearAppBadge (даже с 0, например один раз при загрузке
    // страницы, до первых сообщений), это НАВСЕГДА перекрывало все остальные
    // эвристики до конца сессии, даже если реальный счётчик в DOM потом рос.
    // Не все сайты вызывают Badging API на каждое изменение — если он вызван
    // непоследовательно (или только для дока/таскбара, а не как общий сигнал),
    // результат — залипший неверный (часто нулевой) бейдж. Теперь берём МАКСИМУМ
    // из всех источников, а не даём одному "протухшему нулю" затмевать остальные.
    const hostname = getHostname()
    const title = document.title || ''

    const titleCount = extractUnreadFromTitle(title)

    let domCount
    if (hostname.includes('telegram')) {
        domCount = extractUnreadTelegram()
    } else {
        domCount = extractUnreadGeneric()
    }

    const positiveCandidates = [titleCount, domCount, badgeApiCount]
        .filter((v) => typeof v === 'number' && v > 0)

    if (positiveCandidates.length > 0) return Math.max(...positiveCandidates)

    // Ничего не нашло положительного числа — последний шанс: бейдж на
    // фавиконе (см. hasFaviconBadge). Считаем count = 1 ("есть
    // непрочитанное"), точное число таким способом не получить, но это
    // лучше, чем ложный 0 при рабочей хрупкой вёрстке.
    if (hasFaviconBadge()) return 1

    // Явный 0 от Badging API доверяем, только если вообще ничего другого
    // не нашлось — сайт сам сообщил "непрочитанных нет".
    if (badgeApiCount === 0) return 0

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
    // Преобразует Blob в data:URL
    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(new Error('FileReader failed'))
            reader.readAsDataURL(blob)
        })
    }

    function isValidImageDataUrl(s) {
        return typeof s === 'string' && s.startsWith('data:image') && s.length > 64
    }

    // Запасной путь: рисуем уже отрисованную в DOM картинку на canvas.
    // Работает даже если fetch заблокирован CORS — пиксели уже в памяти.
    function dataUrlFromDomImage(url) {
        try {
            const imgs = Array.from(document.querySelectorAll('img'))
            // Ищем точное совпадение по src / currentSrc
            let el = imgs.find(i => i.currentSrc === url || i.src === url)
            // Частичное совпадение (CDN мог переписать query-параметры)
            if (!el) {
                const base = url.split('?')[0]
                el = imgs.find(i => (i.currentSrc || i.src || '').split('?')[0] === base)
            }
            if (!el || !el.naturalWidth) return null
            const canvas = document.createElement('canvas')
            canvas.width = el.naturalWidth
            canvas.height = el.naturalHeight
            const ctx = canvas.getContext('2d')
            ctx.drawImage(el, 0, 0)
            return canvas.toDataURL('image/png')
        } catch {
            return null  // tainted canvas / cross-origin без CORS
        }
    }

    async function fetchAsDataUrl(url) {
        // 1) пробуем с credentials (нужно для приватных вложений мессенджеров)
        try {
            const res = await fetch(url, { credentials: 'include' })
            if (res.ok) {
                const d = await blobToDataUrl(await res.blob())
                if (isValidImageDataUrl(d)) return d
            }
        } catch {}
        // 2) повтор без credentials (некоторые CDN отклоняют credentialed-запрос при ACAO:*)
        try {
            const res = await fetch(url, { credentials: 'omit', mode: 'cors' })
            if (res.ok) {
                const d = await blobToDataUrl(await res.blob())
                if (isValidImageDataUrl(d)) return d
            }
        } catch {}
        return null
    }

    ipcRenderer.on('download-image', async (_event, url) => {
        let dataUrl = null
        try {
            if (!url) {
                ipcRenderer.sendToHost('image-data', null)
                return
            }

            if (url.startsWith('data:')) {
                dataUrl = url
            } else if (url.startsWith('blob:')) {
                try {
                    const blob = await (await fetch(url)).blob()
                    dataUrl = await blobToDataUrl(blob)
                } catch {}
            } else {
                dataUrl = await fetchAsDataUrl(url)
            }

            // Запасной путь через DOM canvas, если основной не сработал
            if (!isValidImageDataUrl(dataUrl)) {
                dataUrl = dataUrlFromDomImage(url) || dataUrl
            }

            ipcRenderer.sendToHost('image-data', isValidImageDataUrl(dataUrl) ? dataUrl : null)
        } catch {
            const fallback = dataUrlFromDomImage(url)
            ipcRenderer.sendToHost('image-data', isValidImageDataUrl(fallback) ? fallback : null)
        }
    })
}

// ── Диплинки других мессенджеров (MAX / Telegram) ──────────────────────────
// Этот preload инжектится и исполняется ВНУТРИ произвольной чужой страницы
// (Telegram Web, WhatsApp Web и т.п.), поэтому распознавание должно быть
// максимально узким и явным (два конкретных паттерна) — всё нераспознанное
// должно падать в старое поведение без изменений, чтобы не задеть клики по
// ссылкам во всех остальных мессенджерах. Решение "есть ли уже открытая
// вкладка нужного сервиса" здесь принять НЕЛЬЗЯ — у preload'а нет доступа к
// списку вкладок (тот живёт в renderer/messengers.js). Поэтому распознанные
// ссылки уходят через sendToHost() к host-документу (renderer/messengers.js
// слушает 'ipc-message' на самом <webview>), а не напрямую в main процесс —
// именно renderer решает, переключить вкладку или откатиться на open-url.
function classifyDeepLink(href) {
    if (!href) return null
    // tg://resolve?domain=username — Telegram custom-protocol ссылки
    if (/^tg:\/\//i.test(href)) return { service: 'telegram', href }
    // https://max.ru/join/<token> — инвайт-ссылки мессенджера MAX
    if (/^https:\/\/max\.ru\/join\//i.test(href)) return { service: 'max', href }
    return null
}

function bindLinkInterception() {
    document.addEventListener('click', (e) => {
        const link = e.target?.closest && e.target.closest('a[href]')
        if (!link) return

        const href = link.getAttribute('href')
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

        // SECURITY: in-app deep-link routing (tab-switch + loadURL into a
        // DIFFERENT, already-authenticated webview) only fires for a real,
        // user-initiated click (e.isTrusted). Page script can dispatch a
        // synthetic click on any <a> with zero user gesture — without this
        // check, any guest page content (a compromised/malicious ad, a
        // crafted message rendered as HTML, etc.) could silently force
        // e.g. the user's logged-in Telegram tab to navigate, with no
        // interaction at all. A synthetic click on a deep link still falls
        // through to the ordinary open-url path below when possible
        // (max.ru/join is https:// so it qualifies), same as before this
        // feature existed.
        const special = e.isTrusted ? classifyDeepLink(href) : null
        if (special) {
            e.preventDefault()
            e.stopPropagation()
            ipcRenderer.sendToHost('deep-link', special)
            return
        }

        // BUGFIX v1.9.4 ("клики — и обычная внутренняя навигация, и 'скачать
        // файл' — открывали внешний браузер"): раньше это условие ловило
        // ЛЮБОЙ клик по <a href="http(s)://…"> — то есть каждую обычную
        // ссылку на странице, включая внутреннюю SPA-навигацию сайта и
        // ссылки на скачивание.
        //
        // BUGFIX v1.9.5 ("вход в Яндекс.Почте снова открывает браузер"):
        // v1.9.4 сузил условие до "другой хост" вместо "любой http(s)" — но
        // это снова ловило CAM top-level редирект на страницу входа/OAuth
        // (обычно другой поддомен, например passport.yandex.ru), причём
        // РАНЬШЕ, чем клик успевал стать настоящей навигацией. А именно
        // настоящую навигацию (событие 'will-navigate' на самом <webview>,
        // не клик на <a> внутри страницы) уже корректно обрабатывает
        // renderer/webview-tabs-bind.js — там же учтён и OAuth-брокер
        // (isOAuthProviderUrl, item #6). Дублировать эту логику здесь на
        // уровне клика не нужно и вредно: наш собственный preventDefault()
        // тут просто не даёт will-navigate вообще случиться. Поэтому теперь
        // наружу уходит только явное "открыть в новой вкладке"
        // (target=_blank) — вся обычная навигация, включая кросс-доменную,
        // остаётся штатной и попадает под уже правильную обработку хоста.
        if (link.hasAttribute('download')) return

        if (link.target === '_blank') {
            e.preventDefault()
            e.stopPropagation()
            ipcRenderer.send('open-url', href)
        }
    }, true)

    // BUGFIX ("кнопка мессенджера/попапы в Яндекс.Почте открывали внешний
    // браузер"): this used to unconditionally hijack window.open() and send
    // every call straight to the external browser. That pre-empted Chromium's
    // own popup handling entirely — window.open() never got a chance to
    // trigger the <webview>'s native 'new-window' event, which is what
    // renderer/webview-tabs-bind.js actually listens on to route popups
    // through open-popup-window with the messenger's own session (including
    // the item #1/#6 OAuth-broker handling). With window.open overridden
    // here, that whole mechanism was silently unreachable for any popup a
    // guest page opened via window.open() (as opposed to a target="_blank"
    // link). Removed — window.open() now behaves natively, and 'new-window'
    // fires and gets handled as intended.
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
        } else if (!e.shiftKey && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
            shortcut = 'ctrl+='
            e.preventDefault()
        } else if (!e.shiftKey && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
            shortcut = 'ctrl+-'
            e.preventDefault()
        } else if (!e.shiftKey && e.code === 'Digit0') {
            shortcut = 'ctrl+0'
            e.preventDefault()
        } else if (e.shiftKey && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
            shortcut = 'ctrl+shift+='
            e.preventDefault()
        } else if (e.shiftKey && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
            shortcut = 'ctrl+shift+-'
            e.preventDefault()
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

// ── Перетаскивание вложения между мессенджерами — УБРАНО в v1.9.5 ──────────
// Была попытка (v1.9.3) перетаскивать картинку/файл из одного открытого
// мессенджера в другой через 'DownloadURL' в dataTransfer. На практике
// оказалось хуже, чем просто "не работает": Chromium сам добавляет в
// dataTransfer собственные данные для <img> (uri-list и т.п.), и когда
// принимающая страница не обрабатывает drop сама, срабатывает штатный
// fallback браузера — не навигация текущей страницы, а открытие НОВОГО
// окна, что уже прямая помеха пользователю. preventDefault() на dragstart
// эту проблему не решает — он отменяет весь жест перетаскивания целиком,
// а не только дефолтные данные Chromium. Убрано до появления надёжного
// способа, а не оставлено "полуработающим".
function init() {
    bindContextMenuForwarding()
    bindKeyboardForwarding()
    bindDownloadImageHandler()
    bindLinkInterception()
    bindMsgSentDetection()
    startObserver()
    startUnreadInterval()
    setTimeout(checkUnread, 1000)
    // Задержка нужна, чтобы не захватить фавикон самого первого (переходного) рендера как baseline.
    setTimeout(captureBaselineFavicon, 3000)
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