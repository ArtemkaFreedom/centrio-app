// ── Диплинки других мессенджеров (MAX / Telegram) ──────────────────────────
// Классификация (какой href — деплинк какого сервиса) происходит ТОЛЬКО в
// webview-preload.js, и только на настоящем клике пользователя (e.isTrusted)
// — см. подробный комментарий там про то, почему авто-переключение вкладки
// не должно быть доступно script-driven путям (window.open/will-navigate)
// без верифицируемого user gesture. Сюда, в 'ipc-message' → 'deep-link'
// (см. addWebview ниже), долетает уже классифицированный `{service, href}`;
// эта функция лишь переводит его в конечный URL для загрузки в целевой
// вкладке — и на всякий случай ре-валидирует href (defense-in-depth, не
// доверяем каналу вслепую даже несмотря на то, что единственный отправитель
// уже проверен).
function translateDeepLinkUrl(special) {
    if (!special || typeof special.href !== 'string') return null

    if (special.service === 'max') {
        // SECURITY (defense-in-depth): re-validate host-side against the
        // same anchored pattern preload used to classify this link, rather
        // than trusting `href` verbatim just because it arrived tagged
        // `service: 'max'` on the deep-link channel.
        // ВНИМАНИЕ: этот https://max.ru/join/<token> годится ТОЛЬКО как
        // фолбэк для ВНЕШНЕГО браузера (нет открытой вкладки MAX) — там
        // max.ru сам показывает публичную страницу приглашения. НЕ грузить
        // его через loadURL() в уже открытую и залогиненную вкладку MAX —
        // см. extractMaxJoinToken + navigateMaxWebview ниже, там для этого
        // случая same-origin путь (max.ru и web.max.ru — РАЗНЫЕ origin, см.
        // подробности в navigateMaxWebview).
        return /^https:\/\/max\.ru\/join\//i.test(special.href) ? special.href : null
    }

    if (special.service === 'telegram') {
        // tg://resolve?domain=X → https://t.me/X — официальный универсальный
        // редирект-домен Telegram. Годится как фолбэк для ВНЕШНЕГО браузера
        // (routeDeepLinkFromMain / открытие без подходящей вкладки) — там
        // t.me корректно делает client-detection и редиректит сам.
        // ВНИМАНИЕ: НЕ грузить t.me внутри уже открытой и залогиненной
        // вкладки web.telegram.org через loadURL — см. extractTelegramUsername
        // + navigateTelegramWebview ниже, там для этого случая отдельный,
        // same-origin путь без полной навигации.
        const username = extractTelegramUsername(special.href)
        if (username) return `https://t.me/${username}`

        // tg://join?invite=<hash> — приватные инвайт-ссылки (самый частый
        // реальный формат "пришлите ссылку на чат"), у них нет username и
        // extractTelegramUsername() тут всегда вернёт null. t.me/+<hash> —
        // актуальный официальный формат (core.telegram.org/api/links),
        // работает как внешний фолбэк так же, как t.me/<username> выше.
        const invite = extractTelegramInvite(special.href)
        if (invite) return `https://t.me/+${invite}`

        return null
    }

    return null
}

// Отдельно от translateDeepLinkUrl(), т.к. нужен голый username и для
// t.me-фолбэка, и для same-origin hash-навигации внутри уже открытой вкладки.
function extractTelegramUsername(href) {
    if (typeof href !== 'string') return null
    const match = href.match(/[?&]domain=([^&]+)/i)
    if (!match) return null
    try {
        const domain = decodeURIComponent(match[1])
        // Только username-подобные значения — не даём decodeURIComponent
        // результату протащить что-то похожее на путь/query в итоговый URL.
        return /^[a-zA-Z0-9_]{1,64}$/.test(domain) ? domain : null
    } catch {
        return null
    }
}

// Голый инвайт-хэш из tg://join?invite=<hash> (или ...?invite=X&... — порядок
// query-параметров у tg:// не гарантирован). Нужен и для t.me/+<hash>-фолбэка
// в translateDeepLinkUrl(), и для same-origin навигации в navigateTelegramWebview().
function extractTelegramInvite(href) {
    if (typeof href !== 'string') return null
    const match = href.match(/[?&]invite=([^&]+)/i)
    if (!match) return null
    try {
        const hash = decodeURIComponent(match[1])
        // Telegram выдаёт инвайт-хэши как URL-safe токены — та же защита от
        // протаскивания постороннего пути/query через decodeURIComponent,
        // что и у extractTelegramUsername/extractMaxJoinToken выше.
        return /^[A-Za-z0-9_-]{1,64}$/.test(hash) ? hash : null
    } catch {
        return null
    }
}

// BUGFIX ("клик по tg://resolve — переключает на вкладку ТГ, но там вместо
// чата открывается страница-заглушка похожая на браузер, и вкладка потом не
// реагирует ни на что"): раньше routeDeepLink() всегда грузил
// https://t.me/<username> через loadURL() ПРЯМО В уже залогиненную вкладку
// web.telegram.org. t.me — ДРУГОЙ origin (свои куки/сессия), поэтому вместо
// навигации внутри уже открытого веб-клиента показывалась сама t.me
// лендинг-страница (она рассчитана на переход из обычного браузера — делает
// client-detection и пытается редиректнуть на tg://, показывая по пути
// generic "открыть в браузере/приложении" UI — отсюда "выглядит как другой
// браузер"). Открытие tg:// ИЗНУТРИ webview Electron не может завершиться
// успехом (это не зарегistrированный для webview-контента протокол) — сама
// попытка навигации подвешивает фрейм, отсюда "больше ни на что не
// реагирует". Вместо полной навигации на другой origin — если целевая
// вкладка уже открыта на web.telegram.org/<client>/, просто меняем hash
// (#@username) ЧЕРЕЗ executeJavaScript: это тот же приём, которым сам
// t.me/<username> в итоге открывает чат в веб-клиенте, но без ухода с
// текущего origin/сессии и без второго прыжка через посадочную страницу.
// `target` — { type: 'username', value } для tg://resolve или
// { type: 'invite', value } для tg://join?invite= (приватные ссылки-
// приглашения, см. extractTelegramInvite выше).
function navigateTelegramWebview(webview, target) {
    let currentUrl
    try { currentUrl = webview.getURL() || '' } catch { currentUrl = '' }

    const clientMatch = currentUrl.match(/^https:\/\/web\.telegram\.org\/(k|a|z)\//i)
    if (clientMatch) {
        if (target.type === 'username') {
            // Same-origin SPA-навигация: меняем только hash, страница не
            // перезагружается, сессия/логин не трогаются.
            webview.executeJavaScript(`location.hash = '#@${target.value}'`).catch(() => {})
            return
        }

        // invite: у join-по-хэшу нет короткого #@username-роута — вместо
        // него веб-клиенты Telegram сами умеют разбирать произвольный
        // tg://-URI, переданный через хэш `#?tgaddr=<encoded-uri>` (этим же
        // приёмом t.me сам редиректит на web.telegram.org при переходе из
        // обычного браузера — см. core.telegram.org/api/links про формат
        // tg://join?invite=<hash>). Тот же same-origin эффект, что и у
        // #@username: без ухода с текущего origin/сессии.
        const uri = `tg://join?invite=${target.value}`
        webview.executeJavaScript(`location.hash = '#?tgaddr=${encodeURIComponent(uri)}'`).catch(() => {})
        return
    }

    // Неизвестный/другой клиент Telegram (не web.telegram.org/k|a|z/) —
    // ничего умнее t.me тут предложить не можем, это тот же фолбэк, что и
    // при отсутствии вкладки вообще.
    try {
        webview.loadURL(target.type === 'username' ? `https://t.me/${target.value}` : `https://t.me/+${target.value}`)
    } catch {}
}

// Токен инвайта из https://max.ru/join/<token> — нужен отдельно от
// translateDeepLinkUrl(), т.к. для same-origin навигации в уже открытой
// вкладке нужен голый токен, а не полный max.ru-URL.
function extractMaxJoinToken(href) {
    if (typeof href !== 'string') return null
    const match = href.match(/^https:\/\/max\.ru\/join\/([^/?#]+)/i)
    if (!match) return null
    const token = match[1]
    return /^[A-Za-z0-9_-]{1,128}$/.test(token) ? token : null
}

// BUGFIX ("Макс тоже — только лендинг показывает, перехода нет"): та же
// природа бага, что и у Telegram выше, подтверждено вживую (curl): сама
// инвайт-ссылка https://max.ru/join/<token> и реальный веб-клиент MAX
// (обычно https://web.max.ru/, см. renderer/constants.js) — ДВЕ РАЗНЫЕ
// SvelteKit-сборки на РАЗНЫХ origin (разные хэши иммутабельных чанков —
// max.ru отдаёт свой entry/start.*.js, web.max.ru свой; разные
// куки/сессия/localStorage). loadURL(originalHref) уводил уже залогиненную
// вкладку web.max.ru на публичный max.ru/join — оттуда и "только лендинг,
// перехода нет". При этом web.max.ru/join/<token> отдаёт ТОТ ЖЕ SPA-шелл,
// что и web.max.ru/ (проверено — идентичный HTML, 200), т.е. это валидный
// клиентский роут внутри уже открытого приложения. В отличие от Telegram
// (hash-based роутинг в k/a/z клиентах), MAX — путь-based роутинг
// (SvelteKit), поэтому здесь не нужен hash-трюк через executeJavaScript:
// обычная same-origin loadURL() на /join/<token> того же хоста — полная
// перезагрузка, но БЕЗ смены origin, так что сессия (кука/localStorage
// текущего хоста) сохраняется, а SPA сама разрешает join уже
// авторизованным пользователем.
function navigateMaxWebview(webview, token) {
    let currentUrl
    try { currentUrl = webview.getURL() || '' } catch { currentUrl = '' }

    let targetOrigin = 'https://web.max.ru'
    try {
        const parsed = new URL(currentUrl)
        // Берём origin реально загруженной сейчас вкладки (обычно
        // web.max.ru, но если пользователь сам завёл мессенджер на другом
        // поддомене max.ru — останемся на нём, а не силой уведём на
        // web.max.ru). Дефолт 'https://web.max.ru' — на случай, если
        // getURL() ещё не вернул валидный max.ru-адрес (например, вкладка
        // только что создана и ещё не успела загрузиться).
        if (/(^|\.)max\.ru$/i.test(parsed.hostname)) targetOrigin = parsed.origin
    } catch {}

    try { webview.loadURL(`${targetOrigin}/join/${token}`) } catch {}
}

// ── OAuth-брокер для входа через сторонний провайдер внутри webview ────────
// Большинство OAuth-провайдеров (в первую очередь Google) сознательно
// отказывают во входе изнутри embedded-браузера — Electron <webview>
// детектится как небезопасный встроенный браузер, и вместо формы входа
// показывается "This browser or app may not be secure" (или форма просто
// виснет). Решение — не webview, а обычное popup-окно с нормальным
// desktop-UA Chrome и ТОЙ ЖЕ session partition, что и у мессенджера (см.
// main/ipc/window.js open-popup-window → isOAuthBroker): такое окно
// проходит проверку провайдера, а полученные cookies/сессия остаются в
// той же партиции, что и у уже открытого webview мессенджера.
const OAUTH_PROVIDER_HOST_RE = /(^|\.)accounts\.google\.com$|(^|\.)appleid\.apple\.com$|(^|\.)login\.live\.com$|(^|\.)login\.microsoftonline\.com$|(^|\.)oauth\.yandex\.(ru|com)$|(^|\.)id\.vk\.com$/i

function isOAuthProviderUrl(url) {
    try {
        return OAUTH_PROVIDER_HOST_RE.test(new URL(url).hostname)
    } catch {
        return false
    }
}

// BUGFIX ("клик по другому сервису в шапке Яндекс.Почты открывал внешний
// браузер"): 'will-navigate' ниже сравнивал ТОЧНЫЙ hostname навигации с
// hostname мессенджера — но многие сайты (Яндекс, Google и т.п. — целые
// "порталы") держат разные свои сервисы на разных поддоменах одного и того
// же домена (mail.yandex.ru → disk.yandex.ru), между которыми пользователь
// естественно ожидает переходить, не покидая приложение — авторизация у них
// общая на весь домен. Сравниваем базовый домен (последние 2 сегмента) вместо
// точного хоста — переход на ДРУГОЙ поддомен ТОГО ЖЕ домена остаётся внутри
// вкладки, во внешний браузер уходит только реально другой домен. Наивная
// эвристика (не использует публичный suffix-list, значит некорректна для
// доменов вида *.co.uk), но здесь это даже лучше, чем предыдущая крайность
// "любой поддомен — уже не свой".
function baseDomain(hostname) {
    const parts = String(hostname || '').split('.').filter(Boolean)
    return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.')
}

function createWebviewTabsApi({
    state,
    store,
    tabsBar,
    tabsContent,
    findCount,
    webviewContextMenu,
    preloadPath,
    ipcRenderer,
    invokeIpc,
    tGet,
    openFindBar,
    openSettings,
    getActiveWebview,
    applyTabZoom,
    applyAppZoom,
    switchTab,
    removeMessenger,
    watchWebview,
    showContextMenu
}) {
    if (webviewContextMenu && webviewContextMenu.parentElement !== document.body) {
        document.body.appendChild(webviewContextMenu)
    }

    const DEEP_LINK_HOST_MATCHERS = {
        telegram: /(^|\.)telegram\.org$|(^|\.)t\.me$/i,
        max: /(^|\.)max\.ru$/i
    }

    function findMessengerForDeepLinkService(service) {
        const re = DEEP_LINK_HOST_MATCHERS[service]
        if (!re) return null

        return state.activeMessengers.find((m) => {
            try { return re.test(new URL(m.url).hostname) } catch { return false }
        })
    }

    // Пытается открыть распознанный диплинк в уже существующей вкладке нужного
    // сервиса. Возвращает true, если получилось (вкладка переключена и
    // загружена) — false означает "подходящей вкладки нет", и вызывающий код
    // должен откатиться на прежнее поведение (open-url → внешний браузер/ОС).
    function routeDeepLink(special) {
        const url = translateDeepLinkUrl(special)
        if (!url) return false

        const target = findMessengerForDeepLinkService(special.service)
        if (!target) return false

        switchTab(target.id)
        const targetWebview = document.getElementById(`webview-${target.id}`)
        if (targetWebview) {
            if (special.service === 'telegram') {
                // См. подробный BUGFIX-комментарий у navigateTelegramWebview():
                // здесь НЕ грузим `url` (https://t.me/<username или +hash>)
                // через loadURL() — это увело бы уже залогиненную вкладку
                // web.telegram.org на чужой origin (t.me) и подвесило бы её.
                // translateDeepLinkUrl() уже провалидировал username/invite
                // выше (url !== null), так что повторный extract* здесь
                // просто дублирует уже пройденную проверку — no-op в плане
                // безопасности, но избегает парсинга `url` обратно.
                const username = extractTelegramUsername(special.href)
                if (username) {
                    navigateTelegramWebview(targetWebview, { type: 'username', value: username })
                } else {
                    const invite = extractTelegramInvite(special.href)
                    if (invite) navigateTelegramWebview(targetWebview, { type: 'invite', value: invite })
                }
            } else if (special.service === 'max') {
                // См. подробный BUGFIX-комментарий у navigateMaxWebview():
                // здесь НЕ грузим `url` (исходный https://max.ru/join/...)
                // — это увело бы уже залогиненную вкладку web.max.ru на
                // другой origin (публичный max.ru) без перехода к чату.
                const token = extractMaxJoinToken(special.href)
                if (token) navigateMaxWebview(targetWebview, token)
            } else {
                try { targetWebview.loadURL(url) } catch {}
            }
        }
        return true
    }

    // Диплинк, пришедший из ОС (клик по tg://resolve?domain=... в СТОРОННЕМ
    // браузере/приложении — main/services/protocol.js регистрирует Centrio
    // обработчиком tg:// и пересылает сюда через 'deep-link-route', см.
    // preload.js validReceiveChannels). В отличие от клика внутри webview,
    // тут нет "фолбэка на open-url тем же tg://" — раз ОС уже отдала эту
    // ссылку НАМ как зарегистрированному обработчику, повторный
    // shell.openExternal(tg://...) рисковал бы зациклиться обратно на
    // Centrio. Если подходящей вкладки Telegram нет — открываем обычный
    // https://t.me/<domain> во внешнем браузере как безопасный, не
    // зацикливающийся фолбэк (ровно то же поведение, что было бы без этой
    // фичи вообще).
    function routeDeepLinkFromMain(special) {
        if (routeDeepLink(special)) return
        const url = translateDeepLinkUrl(special)
        if (url) ipcRenderer.send('open-url', url)
    }
    ipcRenderer.on('deep-link-route', routeDeepLinkFromMain)

    // OAuth-брокер (main/ipc/window.js open-popup-window → isOAuthBroker)
    // редиректнул на origin мессенджера и закрылся сам — cookies/сессия
    // теперь лежат в той же persist:<id> партиции, что и у webview.
    // Просто перезагружаем вкладку, чтобы она подхватила уже
    // установленный логин без ручного действия пользователя.
    ipcRenderer.on('oauth-popup-done', (payload) => {
        const partition = payload && payload.partition
        if (typeof partition !== 'string' || !partition.startsWith('persist:')) return
        const messengerId = partition.slice('persist:'.length)
        const webview = document.getElementById(`webview-${messengerId}`)
        if (webview) {
            try { webview.reload() } catch {}
        }
    })

    function hideWebviewContextMenu() {
        if (!webviewContextMenu) return
        webviewContextMenu.classList.remove('show')
        webviewContextMenu.style.visibility = ''
    }

    function bindGlobalMenuClose() {
        if (document.__centrioWebviewMenuCloseBound) return
        document.__centrioWebviewMenuCloseBound = true

        document.addEventListener('mousedown', (e) => {
            if (!webviewContextMenu) return
            if (!webviewContextMenu.classList.contains('show')) return
            if (webviewContextMenu.contains(e.target)) return

            hideWebviewContextMenu()
        })

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return
            hideWebviewContextMenu()
        })

        window.addEventListener('blur', () => {
            hideWebviewContextMenu()
        })

        window.addEventListener('resize', () => {
            hideWebviewContextMenu()
        })

        document.addEventListener('scroll', () => {
            hideWebviewContextMenu()
        }, true)
    }

    async function confirmRemoveMessenger(messenger) {
        const message = tGet("webview.removeConfirm").replace("{name}", messenger.name)

        if (typeof window.showConfirmModal === 'function') {
            return await window.showConfirmModal({
                title: tGet("webview.removeTitle"),
                message,
                confirmText: tGet("webview.removeBtn"),
                cancelText: tGet("webview.cancelBtn"),
                danger: true
            })
        }

        return window.confirm(message)
    }

    function addTab(messenger) {
        const tab = document.createElement('div')
        tab.className = 'tab'
        tab.id = `tab-${messenger.id}`

        const hostname = (() => {
            try {
                return new URL(messenger.url).hostname
            } catch {
                return ''
            }
        })()

        const tabMain = document.createElement('div')
        tabMain.className = 'tab-main'

        const icon = document.createElement('img')
        icon.width = 16
        icon.height = 16
        icon.className = 'tab-icon'
        icon.src = messenger.icon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
        icon.onerror = () => {
            if (icon.src.includes('logomessenger') || icon.src.includes('assets')) {
                icon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
                icon.onerror = () => { icon.style.display = 'none' }
            } else {
                icon.style.display = 'none'
            }
        }

        const title = document.createElement('span')
        title.className = 'tab-name'
        title.textContent = messenger.name

        const closeBtn = document.createElement('button')
        closeBtn.className = 'tab-close'
        closeBtn.type = 'button'
        closeBtn.setAttribute('aria-label', tGet("webview.removeTabLabel").replace("{name}", messenger.name))
        closeBtn.setAttribute('title', tGet("webview.removeTabLabel").replace("{name}", messenger.name))
        closeBtn.dataset.id = messenger.id
        closeBtn.textContent = '✕'

        tabMain.appendChild(icon)
        tabMain.appendChild(title)
        tab.appendChild(tabMain)
        tab.appendChild(closeBtn)

        tab.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) return
            switchTab(messenger.id)
        })

        closeBtn.addEventListener('click', async (e) => {
            e.preventDefault()
            e.stopPropagation()

            const confirmed = await confirmRemoveMessenger(messenger)
            if (!confirmed) return

            removeMessenger(messenger.id)
        })

        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            e.stopPropagation()

            switchTab(messenger.id)

            if (typeof showContextMenu === 'function') {
                showContextMenu(e, messenger.id)
            }
        })

        initTabDrag(tab, messenger.id)
        tabsBar.appendChild(tab)
    }

    let _tabDragSrcId = null

    // ── Порядок вкладок (персист, аналогично sidebarOrder в sidebar-dnd-bind.js) ──
    function saveTabOrder() {
        const order = Array.from(tabsBar.querySelectorAll(':scope > .tab'))
            .map(t => t.id.replace('tab-', ''))
        store.set('tabOrder', order)
    }

    function loadTabOrder() {
        const order = store.get('tabOrder', [])
        if (!order.length) return
        order.forEach(id => {
            const el = document.getElementById(`tab-${id}`)
            if (el && el.parentElement === tabsBar) tabsBar.appendChild(el)
        })
    }

    function initTabDrag(tab, messengerId) {
        tab.setAttribute('draggable', 'true')

        tab.addEventListener('dragstart', (e) => {
            _tabDragSrcId = messengerId
            setTimeout(() => tab.classList.add('tab-dragging'), 0)
            e.dataTransfer.effectAllowed = 'move'
            e.stopPropagation()
        })

        tab.addEventListener('dragend', () => {
            tab.classList.remove('tab-dragging')
            tabsBar.querySelectorAll('.tab').forEach(t =>
                t.classList.remove('tab-drop-before', 'tab-drop-after'))
            _tabDragSrcId = null
        })

        tab.addEventListener('dragover', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!_tabDragSrcId || _tabDragSrcId === messengerId) return
            const rect = tab.getBoundingClientRect()
            const insertBefore = e.clientX < rect.left + rect.width / 2
            tabsBar.querySelectorAll('.tab').forEach(t =>
                t.classList.remove('tab-drop-before', 'tab-drop-after'))
            tab.classList.add(insertBefore ? 'tab-drop-before' : 'tab-drop-after')
            e.dataTransfer.dropEffect = 'move'
        })

        tab.addEventListener('dragleave', (e) => {
            if (!tab.contains(e.relatedTarget))
                tab.classList.remove('tab-drop-before', 'tab-drop-after')
        })

        tab.addEventListener('drop', (e) => {
            e.preventDefault()
            e.stopPropagation()
            tab.classList.remove('tab-drop-before', 'tab-drop-after')
            if (!_tabDragSrcId || _tabDragSrcId === messengerId) return
            const srcTab = document.getElementById(`tab-${_tabDragSrcId}`)
            if (!srcTab) return
            const rect = tab.getBoundingClientRect()
            const insertBefore = e.clientX < rect.left + rect.width / 2
            if (insertBefore) tabsBar.insertBefore(srcTab, tab)
            else tabsBar.insertBefore(srcTab, tab.nextSibling)
            saveTabOrder()
        })
    }

    function attachFindListener(webview) {
        webview.addEventListener('found-in-page', (e) => {
            const { activeMatchOrdinal, matches } = e.result
            if (matches > 0) {
                findCount.textContent = `${activeMatchOrdinal} / ${matches}`
                findCount.style.color = 'var(--text-secondary)'
            } else {
                findCount.textContent = tGet('search.notFound')
                findCount.style.color = 'var(--danger)'
            }
        })
    }

    function attachContextMenu(webview, messenger) {
        webview.addEventListener('ipc-message', (e) => {
            if (e.channel === 'close-context-menu') {
                hideWebviewContextMenu()
                return
            }

            if (e.channel === 'image-data') {
                const dataUrl = e.args[0]
                if (dataUrl) {
                    if (state._wvCopyMode) {
                        // Копируем в буфер обмена через главный процесс
                        invokeIpc('copy-image-to-clipboard', dataUrl).catch(() => {})
                    } else {
                        // Сохраняем в файл
                        ipcRenderer.send('save-image-data', dataUrl, state.wvContextParams._filePath || '')
                    }
                }
                state._wvCopyMode = false
                return
            }

            // Горячие клавиши, пересланные из webview (когда фокус внутри)
            if (e.channel === 'keyboard-shortcut') {
                const shortcut = e.args[0]
                if (!shortcut) return

                if (shortcut === 'ctrl+r') {
                    if (state.activeTabId) {
                        document.getElementById(`webview-${state.activeTabId}`)?.reload()
                    }
                    return
                }

                if (shortcut === 'ctrl+tab') {
                    if (!state.activeMessengers.length) return
                    const idx = state.activeMessengers.findIndex(m => m.id === state.activeTabId)
                    if (idx === -1) return
                    switchTab(state.activeMessengers[(idx + 1) % state.activeMessengers.length].id)
                    return
                }

                if (shortcut === 'ctrl+shift+tab') {
                    if (!state.activeMessengers.length) return
                    const idx = state.activeMessengers.findIndex(m => m.id === state.activeTabId)
                    if (idx === -1) return
                    switchTab(state.activeMessengers[(idx - 1 + state.activeMessengers.length) % state.activeMessengers.length].id)
                    return
                }

                const numMatch = shortcut.match(/^ctrl\+(\d)$/)
                if (numMatch) {
                    const idx = parseInt(numMatch[1]) - 1
                    if (state.activeMessengers[idx]) switchTab(state.activeMessengers[idx].id)
                    return
                }

                if (shortcut === 'ctrl+f') {
                    if (typeof openFindBar === 'function') openFindBar()
                    return
                }

                if (shortcut === 'ctrl+search') {
                    document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, code: 'KeyK', key: 'k', bubbles: true, cancelable: true }))
                    return
                }

                if (shortcut === 'ctrl+comma') {
                    if (typeof openSettings === 'function') openSettings()
                    return
                }

                if (shortcut === 'ctrl+=') {
                    if (typeof applyTabZoom === 'function') applyTabZoom(state.tabZoomLevel + 0.25)
                    return
                }

                if (shortcut === 'ctrl+-') {
                    if (typeof applyTabZoom === 'function') applyTabZoom(state.tabZoomLevel - 0.25)
                    return
                }

                if (shortcut === 'ctrl+0') {
                    if (typeof applyTabZoom === 'function') applyTabZoom(1.0)
                    return
                }

                if (shortcut === 'ctrl+shift+=') {
                    if (typeof applyAppZoom === 'function') applyAppZoom(state.appZoomLevel + 1)
                    return
                }

                if (shortcut === 'ctrl+shift+-') {
                    if (typeof applyAppZoom === 'function') applyAppZoom(state.appZoomLevel - 1)
                    return
                }

                return
            }

            if (e.channel !== 'context-menu') return

            // Переключаемся на нужный мессенджер, чтобы zoom применялся правильно
            if (messenger?.id && state.activeTabId !== messenger.id) {
                switchTab(messenger.id)
            }

            const params = e.args[0] || {}
            state.wvContextParams = params

            document.querySelectorAll('.context-menu').forEach((m) => {
                m.classList.remove('show')
                m.style.visibility = ''
            })

            const saveImageItem = document.getElementById('wvSaveImage')
            if (saveImageItem) {
                saveImageItem.style.display = params.mediaType === 'image' ? 'flex' : 'none'
            }

            const copyItem = document.getElementById('wvCopy')
            if (copyItem) {
                const hasCopy = params.mediaType === 'image' || !!params.selectionText
                copyItem.style.display = hasCopy ? 'flex' : 'none'
                const dividerAfterCopy = copyItem.nextElementSibling
                if (dividerAfterCopy?.classList.contains('context-divider')) {
                    dividerAfterCopy.style.display = hasCopy ? '' : 'none'
                }
            }

            const translateItem = document.getElementById('wvTranslate')
            if (translateItem) {
                const extState = store.get('extensionsState', {})
                const canTranslate = !!params.selectionText && extState.translate === true
                translateItem.style.display = canTranslate ? 'flex' : 'none'
                const wvTranslateDivider = document.getElementById('wvTranslateDivider')
                if (wvTranslateDivider) wvTranslateDivider.style.display = canTranslate ? 'block' : 'none'
            }

            const webviewRect = webview.getBoundingClientRect()
            const localX = Number(params.clientX ?? params.x ?? 0)
            const localY = Number(params.clientY ?? params.y ?? 0)
            const zoom = Number(state.tabZoomLevel || 1)
            const margin = 8
            const pointerOffset = 2

            let left = webviewRect.left + localX * zoom + pointerOffset
            let top = webviewRect.top + localY * zoom + pointerOffset

            webviewContextMenu.style.position = 'fixed'
            webviewContextMenu.style.left = '0px'
            webviewContextMenu.style.top = '0px'
            webviewContextMenu.style.visibility = 'hidden'
            webviewContextMenu.classList.add('show')

            requestAnimationFrame(() => {
                const menuRect = webviewContextMenu.getBoundingClientRect()

                const fitsBelow = top + menuRect.height <= window.innerHeight - margin
                const fitsRight = left + menuRect.width <= window.innerWidth - margin

                if (!fitsBelow) {
                    top = top - menuRect.height - pointerOffset * 2
                }

                if (!fitsRight) {
                    left = left - menuRect.width - pointerOffset * 2
                }

                const maxLeft = window.innerWidth - menuRect.width - margin
                const maxTop = window.innerHeight - menuRect.height - margin

                if (left > maxLeft) left = Math.max(margin, maxLeft)
                if (top > maxTop) top = Math.max(margin, maxTop)

                if (left < margin) left = margin
                if (top < margin) top = margin

                webviewContextMenu.style.left = `${Math.round(left)}px`
                webviewContextMenu.style.top = `${Math.round(top)}px`
                webviewContextMenu.style.visibility = 'visible'
            })
        })
    }

    function addWebview(messenger) {
        invokeIpc('ext:apply-to-session', `persist:${messenger.id}`).catch(() => {})
        const webview = document.createElement('webview')
        webview.id = `webview-${messenger.id}`
        webview.src = messenger.url
        webview.setAttribute('allowpopups', 'true')
        webview.setAttribute('partition', `persist:${messenger.id}`)
        webview.setAttribute(
            'useragent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        webview.setAttribute('preload', preloadPath)

        const extState = store.get('extensionsState', {})
        if (extState.grammarly === true) {
            webview.setAttribute('spellcheck', 'true')
        }

        const applyInitialZoom = () => {
            const zoomLevel = typeof messenger.zoomLevel === 'number'
                ? messenger.zoomLevel
                : Number(state.tabZoomLevel || 1)

            try {
                webview.setZoomFactor(zoomLevel)
            } catch {}
        }

        webview.addEventListener('dom-ready', () => {
            applyInitialZoom()

            if (messenger.forceDarkMode) {
                const css = `
                    html { filter: invert(1) hue-rotate(180deg) !important; }
                    img, video, canvas, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }
                `
                webview.insertCSS(css)
            }

        })

        webview.addEventListener('did-finish-load', applyInitialZoom)
        webview.addEventListener('did-finish-load', () => {
            // Адаптивная тема: перечитываем цвет после загрузки страницы
            if (webview.classList.contains('active')) {
                const { updateAdaptiveTheme } = require('./settings-ui')
                updateAdaptiveTheme(() => webview)
            }
        })

        // Split mode: track which pane has focus when user clicks inside a webview
        webview.addEventListener('focus', () => {
            window.__centrioSplitFocus?.(webview)
        })


        webview.addEventListener('new-window', (e) => {
            e.preventDefault()
            const url = e.url
            if (!url || url === 'about:blank') return
            if (url.startsWith('chrome-extension://')) {
                // Webview-shell обход: грузим data:HTML с <webview src> — webview guest
                // navigations идут другим code-path и не блокируются ExtensionNavigationThrottle.
                invokeIpc('open-popup-window', url, {
                    width:     e.frameName === 'popup' ? 380 : 400,
                    height:    600,
                    partition: messenger?.id ? `persist:${messenger.id}` : 'persist:ext-popup',
                }).catch(() => {})
                return
            }

            // BUGFIX (item #1 — popups falling through to the external
            // browser): window.open() calls from a messenger webview (call/
            // meeting windows, share dialogs, "sign in with X" popups, ...)
            // used to always go through the plain open-url fallback below,
            // landing in the user's default browser with none of the
            // session the messenger itself is logged into. Route http(s)
            // popups through open-popup-window instead, sharing this
            // messenger's own partition — see main/ipc/window.js
            // (isSharedMessengerSession is allowlisted there against known
            // messenger partitions, so this can't be used to read an
            // arbitrary session). Recognized OAuth-provider popups (item
            // #6) additionally get returnHost so the main process can close
            // the popup and hand control back once sign-in completes — see
            // isOAuthProviderUrl()/OAUTH_PROVIDER_HOST_RE above.
            if ((url.startsWith('http://') || url.startsWith('https://')) && messenger?.id) {
                const popupOpts = {
                    width: 500,
                    height: 650,
                    name: messenger.name || 'Centrio',
                    partition: `persist:${messenger.id}`
                }

                if (isOAuthProviderUrl(url)) {
                    try { popupOpts.returnHost = new URL(messenger.url).hostname } catch {}
                }

                invokeIpc('open-popup-window', url, popupOpts)
                    .then((result) => {
                        if (!result || result.success !== true) ipcRenderer.send('open-url', url)
                    })
                    .catch(() => ipcRenderer.send('open-url', url))
                return
            }

            // SECURITY: 'new-window' (like 'will-navigate' below) can be
            // reached from page script with no verifiable real user
            // gesture, so it deliberately does NOT auto-route into another
            // tab — only the trusted-click path from webview-preload.js
            // (delivered via the 'ipc-message' → 'deep-link' listener
            // further down) is allowed to do that. This just keeps the
            // pre-existing external-open fallback for everything else,
            // recognized deep links included.
            ipcRenderer.send('open-url', url)
        })

        webview.addEventListener('will-navigate', (e) => {
            const url = e.url
            if (!url) return
            try {
                const messengerHost = new URL(messenger.url).hostname
                const navHost = new URL(url).hostname
                if (baseDomain(navHost) !== baseDomain(messengerHost) && !url.startsWith('file://')) {
                    e.preventDefault()

                    // Item #6: some providers run OAuth as a full top-level
                    // redirect (not a window.open() popup) straight out of
                    // the messenger webview itself. Same in-app broker
                    // hand-off as the 'new-window' branch above instead of
                    // sending it to the external browser.
                    if (isOAuthProviderUrl(url) && messenger?.id) {
                        let returnHost = ''
                        try { returnHost = new URL(messenger.url).hostname } catch {}
                        if (returnHost) {
                            invokeIpc('open-popup-window', url, {
                                width: 500,
                                height: 650,
                                name: messenger.name || 'Centrio',
                                partition: `persist:${messenger.id}`,
                                returnHost
                            }).catch(() => {})
                            return
                        }
                    }

                    ipcRenderer.send('open-url', url)
                }
            } catch {}
        })

        // Диплинк, распознанный и перехваченный ВНУТРИ гостевой страницы
        // (webview-preload.js classifyDeepLink → ipcRenderer.sendToHost),
        // и ТОЛЬКО когда клик был настоящим (e.isTrusted, см. preload) —
        // единственный путь, по которому мы автоматически переключаем
        // вкладку и грузим URL в чужом, уже залогиненном webview.
        webview.addEventListener('ipc-message', (e) => {
            if (e.channel !== 'deep-link') return
            const special = e.args[0]
            if (special && routeDeepLink(special)) return

            // SECURITY: fallback must use the TRANSLATED URL (e.g.
            // https://t.me/<domain>), never the raw special.href. tg: is
            // an allowed external-open scheme (main/ipc/window.js
            // ALLOWED_SCHEMES) and Centrio can be the OS's registered
            // tg:// handler (see main/services/protocol.js) — sending the
            // raw tg://resolve?... href back to open-url would bounce
            // straight back into this same app via the second-instance/
            // protocol-url path (one-hop refocus/relaunch flash on every
            // click with no matching tab open). Mirrors the same
            // loop-avoidance already used by routeDeepLinkFromMain below.
            const url = translateDeepLinkUrl(special)
            if (url) ipcRenderer.send('open-url', url)
        })

        // BUGFIX ("MAX обновляется постоянно" — MAX kept refreshing in a
        // loop): this used to reload messenger.url on ANY did-fail-load with
        // no isMainFrame check and no backoff. did-fail-load fires per-FRAME
        // — a single blocked sub-resource (an ad/analytics iframe, or a
        // request our own adblock service killed — see
        // main/services/adblock.js, applied to every webview session) is
        // enough to trigger it even though the page itself loaded fine. On
        // a heavy SPA like MAX/Telegram that has many such sub-frame
        // requests, reloading the WHOLE page every time one of them fails
        // reloads the page, which re-issues the same requests, which fail
        // again the same way — an unthrottled reload loop with no visible
        // error. Two fixes: (1) only reload on a MAIN-frame failure — a
        // sub-frame failing doesn't mean the tab itself is broken; (2) apply
        // exponential backoff + reset-on-success, same pattern already used
        // by the (currently unused) legacy addWebview in
        // renderer/messengers.js, so a persistently-failing main frame
        // retries with increasing delay instead of hammering in a tight loop.
        webview.addEventListener('did-fail-load', (e) => {
            if (e.errorCode === -3) return // ERR_ABORTED — normal cancelled navigation
            if (e.isMainFrame === false) return // sub-frame/sub-resource failure — not the tab itself

            const attempts = (webview._reloadAttempts || 0) + 1
            webview._reloadAttempts = attempts
            const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000)
            clearTimeout(webview._reloadTimer)
            webview._reloadTimer = setTimeout(() => {
                try { webview.loadURL(messenger.url) } catch {}
            }, delay)
        })

        webview.addEventListener('did-finish-load', () => {
            webview._reloadAttempts = 0
        })

        watchWebview(webview, messenger)
        attachFindListener(webview)
        attachContextMenu(webview, messenger)

        tabsContent.appendChild(webview)
        tabsContent.style.pointerEvents = 'auto'
    }

    function bindWebviewContextMenuActions() {
        bindGlobalMenuClose()

        document.getElementById('wvTranslate')?.addEventListener('click', () => {
            const text = (state.wvContextParams || {}).selectionText || ''
            if (text) ipcRenderer.send('open-translate-window', text)
            hideWebviewContextMenu()
        })

        document.getElementById('wvCopy')?.addEventListener('click', async () => {
            const params = state.wvContextParams || {}
            if (params.mediaType === 'image' && params.srcURL) {
                // Скачиваем картинку через preload → копируем через main process clipboard
                const wv = getActiveWebview()
                if (wv) {
                    state._wvCopyMode = true
                    wv.send('download-image', params.srcURL)
                }
            } else if (params.selectionText) {
                // Копируем выделенный текст
                try {
                    await navigator.clipboard.writeText(params.selectionText)
                } catch {
                    // fallback если clipboard API недоступен
                    invokeIpc('copy-text-to-clipboard', params.selectionText).catch(() => {})
                }
            }
            hideWebviewContextMenu()
        })

        document.getElementById('wvSavePage')?.addEventListener('click', () => {
            ipcRenderer.send('save-page')
            hideWebviewContextMenu()
        })

        document.getElementById('wvSaveImage')?.addEventListener('click', async () => {
            hideWebviewContextMenu()
            if (!state.wvContextParams.srcURL) return

            const wv = getActiveWebview()
            if (!wv) return

            const result = await invokeIpc('get-save-image-path', state.wvContextParams.srcURL)
            if (!result.success) return

            const filePath = result.data
            if (!filePath) return

            state.wvContextParams._filePath = filePath
            wv.send('download-image', state.wvContextParams.srcURL)
        })

        document.getElementById('wvZoomIn')?.addEventListener('click', () => {
            applyTabZoom(state.tabZoomLevel + 0.25)
            hideWebviewContextMenu()
        })

        document.getElementById('wvZoomOut')?.addEventListener('click', () => {
            applyTabZoom(state.tabZoomLevel - 0.25)
            hideWebviewContextMenu()
        })

        document.getElementById('wvZoomReset')?.addEventListener('click', () => {
            applyTabZoom(1.0)
            hideWebviewContextMenu()
        })

        document.getElementById('wvFind')?.addEventListener('click', () => {
            openFindBar()
            hideWebviewContextMenu()
        })

        document.getElementById('wvPrint')?.addEventListener('click', () => {
            getActiveWebview()?.print()
            hideWebviewContextMenu()
        })
    }

    return {
        addTab,
        attachFindListener,
        attachContextMenu,
        addWebview,
        bindWebviewContextMenuActions,
        saveTabOrder,
        loadTabOrder
    }
}

module.exports = {
    createWebviewTabsApi
}