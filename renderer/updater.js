// Список изменений по версиям (показывается в окне обновления)
const CHANGELOG = {
    '1.6.87': [
        'Адаптивная тема: цвет подстраивается под мессенджер',
        'Полностью переработано окно обновления с чейнжлогом',
        'Исправлено переключение языка интерфейса',
        'Улучшен внешний вид светлой темы в настройках',
    ],
    '1.6.86': [
        'Zoom (Ctrl+/Ctrl−) теперь работает из фокуса мессенджера',
        'Смена языка интерфейса работает надёжно',
        'Светлая тема: более мягкие границы и контрасты',
    ],
    '1.6.85': [
        'Горячие клавиши зума приложения (Ctrl+Shift+=/−)',
        'Контекстное меню «Перевести страницу»',
        'Чейнджлог в статусбаре',
    ],
}

// Всегда показываем максимум N пунктов чейнжлога
const MAX_CHANGES = 4

function getChangelog(version) {
    if (!version) return []
    // Ищем точное совпадение, затем ближайший ключ
    if (CHANGELOG[version]) return CHANGELOG[version].slice(0, MAX_CHANGES)
    const keys = Object.keys(CHANGELOG).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    return keys.length ? CHANGELOG[keys[0]].slice(0, MAX_CHANGES) : []
}

function getUpdateContainer() {
    let container = document.getElementById('updateToastContainer')
    if (!container) {
        container = document.createElement('div')
        container.id = 'updateToastContainer'
        container.className = 'update-toast-container'
        document.body.appendChild(container)
    }
    return container
}

function removeExistingCard() {
    const existing = document.getElementById('updateToast')
    if (!existing) return
    existing.classList.remove('show')
    setTimeout(() => { if (existing.parentNode) existing.remove() }, 400)
}

function createUpdateCard({ type = 'info', icon, title, version, changes = [], progress = null, button = null }) {
    const card = document.createElement('div')
    card.id = 'updateToast'
    card.className = 'update-card'

    // Stripe
    const stripe = document.createElement('div')
    stripe.className = `update-card-stripe ${type === 'success' ? 'success' : type === 'error' ? 'error' : ''}`
    card.appendChild(stripe)

    // Header
    const head = document.createElement('div')
    head.className = 'update-card-head'

    const iconEl = document.createElement('div')
    iconEl.className = `update-card-icon ${type === 'success' ? 'success' : type === 'error' ? 'error' : ''}`
    iconEl.textContent = icon

    const infoEl = document.createElement('div')
    infoEl.className = 'update-card-info'
    const titleEl = document.createElement('div')
    titleEl.className = 'update-card-title'
    titleEl.textContent = title
    infoEl.appendChild(titleEl)
    if (version) {
        const verEl = document.createElement('div')
        verEl.className = 'update-card-version'
        verEl.textContent = `v${version}`
        infoEl.appendChild(verEl)
    }

    const closeBtn = document.createElement('button')
    closeBtn.className = 'update-card-close'
    closeBtn.type = 'button'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => {
        card.classList.remove('show')
        setTimeout(() => { if (card.parentNode) card.remove() }, 400)
    })

    head.appendChild(iconEl)
    head.appendChild(infoEl)
    head.appendChild(closeBtn)
    card.appendChild(head)

    // Changelog
    if (changes.length > 0) {
        const divider = document.createElement('div')
        divider.className = 'update-card-divider'
        card.appendChild(divider)

        const changelog = document.createElement('div')
        changelog.className = 'update-card-changelog'
        changes.forEach(text => {
            const item = document.createElement('div')
            item.className = 'update-card-change'
            item.textContent = text
            changelog.appendChild(item)
        })
        card.appendChild(changelog)
    }

    // Progress bar
    if (progress !== null) {
        const divider2 = document.createElement('div')
        divider2.className = 'update-card-divider'
        card.appendChild(divider2)

        const progressWrap = document.createElement('div')
        progressWrap.className = 'update-card-progress-wrap'
        progressWrap.id = 'updateCardProgressWrap'

        const label = document.createElement('div')
        label.className = 'update-card-progress-label'
        const statusEl = document.createElement('span')
        statusEl.className = 'update-card-progress-status'
        statusEl.id = 'updateCardStatus'
        statusEl.textContent = `${progress}%`
        const pctEl = document.createElement('span')
        pctEl.className = 'update-card-progress-pct'
        pctEl.id = 'updateCardPct'
        pctEl.textContent = `${progress}%`
        label.appendChild(statusEl)
        label.appendChild(pctEl)

        const barWrap = document.createElement('div')
        barWrap.className = 'update-card-progress-bar'
        const fill = document.createElement('div')
        fill.className = 'update-card-progress-fill'
        fill.id = 'updateCardFill'
        fill.style.width = `${progress}%`
        barWrap.appendChild(fill)

        progressWrap.appendChild(label)
        progressWrap.appendChild(barWrap)
        card.appendChild(progressWrap)
    }

    // Action button
    if (button) {
        const divider3 = document.createElement('div')
        divider3.className = 'update-card-divider'
        card.appendChild(divider3)

        const actions = document.createElement('div')
        actions.className = 'update-card-actions'
        const btn = document.createElement('button')
        btn.className = `update-card-btn ${type === 'success' ? 'success' : ''}`
        btn.textContent = button.text
        btn.addEventListener('click', button.action)
        actions.appendChild(btn)
        card.appendChild(actions)
    }

    return card
}

function showUpdateCard(opts) {
    removeExistingCard()
    const container = getUpdateContainer()
    const card = createUpdateCard(opts)
    container.appendChild(card)
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')))

    // Auto-dismiss informational cards without a button
    if (!opts.button && opts.type !== 'error') {
        setTimeout(() => {
            card.classList.remove('show')
            setTimeout(() => { if (card.parentNode) card.remove() }, 400)
        }, 6000)
    }
}

// Обновляем прогресс-бар уже показанной карточки
function updateCardProgress(percent) {
    const fill = document.getElementById('updateCardFill')
    const pct  = document.getElementById('updateCardPct')
    const status = document.getElementById('updateCardStatus')
    if (fill) fill.style.width = `${percent}%`
    if (pct)  pct.textContent = `${percent}%`
    if (status) status.textContent = `${percent}%`
}

// Обратная совместимость — старый API тостов
function showUpdateBanner(message, type = 'info', button = null) {
    showUpdateCard({
        type,
        icon: type === 'success' ? '✓' : type === 'error' ? '⚠' : '📦',
        title: message,
        version: null,
        changes: [],
        progress: null,
        button,
    })
}

let _lastDownloadingPercent = 0

function bindUpdater({ ipcRenderer, invokeIpc, showUpdateBanner: _compat, tGet }) {
    ipcRenderer.on('update-status', (data = {}) => {
        if (!data || typeof data !== 'object') {
            console.warn('[updater] Invalid update-status payload:', data)
            return
        }

        const { status = 'unknown', version = '', percent = 0, error = null } = data

        if (status === 'checking') return

        if (status === 'available') {
            const changes = getChangelog(version)
            showUpdateCard({
                type: 'info',
                icon: '🚀',
                title: tGet('updater.available'),
                version,
                changes,
            })
            return
        }

        if (status === 'downloading') {
            const p = Math.round(percent || 0)
            // Если карточка уже показана — просто обновляем прогресс
            if (document.getElementById('updateToast')) {
                updateCardProgress(p)
                _lastDownloadingPercent = p
                return
            }
            const changes = getChangelog(version)
            showUpdateCard({
                type: 'info',
                icon: '⬇',
                title: tGet('updater.downloading'),
                version,
                changes,
                progress: p,
            })
            _lastDownloadingPercent = p
            return
        }

        if (status === 'downloaded') {
            const changes = getChangelog(version)
            showUpdateCard({
                type: 'success',
                icon: '✅',
                title: tGet('updater.downloaded'),
                version,
                changes,
                button: {
                    text: tGet('updater.installRestart'),
                    action: () => invokeIpc('install-update'),
                },
            })
            return
        }

        if (status === 'not-available') {
            showUpdateCard({
                type: 'success',
                icon: '✓',
                title: tGet('updater.notAvailable'),
                version: null,
                changes: [],
            })
            return
        }

        if (status === 'error') {
            console.warn('[updater] Update error:', error)
            showUpdateCard({
                type: 'error',
                icon: '⚠',
                title: tGet('updater.error'),
                version: null,
                changes: [],
            })
        }
    })
}

module.exports = {
    bindUpdater,
    showUpdateBanner,
}
