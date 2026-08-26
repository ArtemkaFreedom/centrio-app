// REDESIGN (2026-08-24, "Полностью переработай окно выбора нового мессенджера
// с плюсика ... Новый дизайн, больше значков, другая анимация, другая
// прокрутка" — live user request, explicit dislike of the old design).
//
// Что было: сетка 4×2 (8 плиток), листалась ЦЕЛЫМИ СТРАНИЦАМИ по колесу
// мыши (e.preventDefault() перехватывал wheel целиком) + точки-пагинатор
// сбоку — нестандартная и заметно "дёрганная" прокрутка, из 43 сервисов
// одновременно видно было только 8.
//
// Что стало: один непрерывный нативный скролл (никакого preventDefault на
// wheel — колесо мыши работает как везде), все сервисы сгруппированы под
// заголовками секций (см. CATEGORY_ORDER, значения приходят из
// messenger.category в renderer/constants.js), плитки при открытии модалки
// появляются с лёгкой ступенчатой (staggered) анимацией, при наведении
// подсвечиваются РЕАЛЬНЫМ фирменным цветом сервиса (messenger.color) —
// а не одним общим акцентом на всё подряд. Тонкая шкала прогресса прокрутки
// над сеткой — сигнатурный элемент, показывает, сколько ещё сервисов ниже.
const CATEGORY_ORDER = ['top', 'messengers', 'mail', 'productivity', 'ai']
const CATEGORY_LABEL_KEYS = {
    // 'top' переиспользует уже существующий (ранее нигде не подключённый)
    // ключ modal.popular — не заводим дублирующий по смыслу текст.
    top: 'modal.popular',
    messengers: 'modal.categories.messengers',
    mail: 'modal.categories.mail',
    productivity: 'modal.categories.productivity',
    ai: 'modal.categories.ai'
}
// Максимальная задержка ступенчатой анимации — дальше плитки просто не ждут
// своей очереди (иначе при 43 элементах последняя плитка появлялась бы почти
// секунду спустя после открытия модалки, что выглядело бы как лаг, а не как
// анимация).
const STAGGER_STEP_MS = 14
const STAGGER_MAX_MS = 240

function createAddModalUiApi({
    state,
    popularMessengers,
    addModal,
    messengerGrid,
    addMessenger,
    tGet
}) {
    const prefersReducedMotion = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function buildTile(messenger, globalIndex) {
        const item = document.createElement('div')
        item.className = 'messenger-grid-item'
        if (!prefersReducedMotion) {
            item.style.animationDelay = `${Math.min(globalIndex * STAGGER_STEP_MS, STAGGER_MAX_MS)}ms`
        } else {
            item.classList.add('no-stagger')
        }
        if (messenger.color) {
            item.style.setProperty('--tile-glow', messenger.color)
        }

        const hostname = (() => {
            try { return new URL(messenger.url).hostname } catch { return '' }
        })()

        item.innerHTML = `
            <img src="${messenger.icon}"
                 onerror="this.src='https://www.google.com/s2/favicons?domain=${hostname}&sz=64'"
                 alt="${messenger.name}" loading="lazy">
            <span>${messenger.name}</span>
        `

        item.addEventListener('click', () => {
            addMessenger(messenger)
            closeModal()
        })

        return item
    }

    function buildEmptyState() {
        const empty = document.createElement('div')
        empty.className = 'modal-grid-empty'
        empty.innerHTML = `
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span>${tGet ? tGet('search.empty') : ''}</span>
        `
        return empty
    }

    function fillMessengerGrid() {
        messengerGrid.innerHTML = ''

        const list = state.modalFiltered
        if (!list.length) {
            messengerGrid.appendChild(buildEmptyState())
            updateScrollProgress()
            return
        }

        const byCategory = new Map()
        list.forEach((m) => {
            const key = m.category || 'messengers'
            if (!byCategory.has(key)) byCategory.set(key, [])
            byCategory.get(key).push(m)
        })

        // Категории, не встречающиеся в CATEGORY_ORDER (на будущее, если кто-то
        // забудет проставить category в constants.js), дорисовываем в конце —
        // чтобы новый сервис молча не пропал из пикера.
        const orderedKeys = [
            ...CATEGORY_ORDER.filter((k) => byCategory.has(k)),
            ...[...byCategory.keys()].filter((k) => !CATEGORY_ORDER.includes(k))
        ]

        let globalIndex = 0
        orderedKeys.forEach((key) => {
            const items = byCategory.get(key)
            const section = document.createElement('div')
            section.className = 'modal-category'

            const header = document.createElement('div')
            header.className = 'modal-category-header'
            const labelKey = CATEGORY_LABEL_KEYS[key]
            header.innerHTML = `
                <span class="modal-category-label">${labelKey && tGet ? tGet(labelKey) : key}</span>
                <span class="modal-category-count">${items.length}</span>
            `
            section.appendChild(header)

            const grid = document.createElement('div')
            grid.className = 'messenger-grid'
            items.forEach((messenger) => {
                grid.appendChild(buildTile(messenger, globalIndex))
                globalIndex++
            })
            section.appendChild(grid)

            messengerGrid.appendChild(section)
        })

        updateScrollProgress()
    }

    // Тонкая шкала прогресса прокрутки под поиском — сигнатурный элемент
    // редизайна: замена точек-пагинатора наглядным индикатором "сколько ещё
    // сервисов ниже", без прерывания нативного скролла.
    function updateScrollProgress() {
        const wrap = document.getElementById('modalGridWrap')
        const bar = document.getElementById('modalScrollProgressBar')
        if (!wrap || !bar) return
        const scrollable = wrap.scrollHeight - wrap.clientHeight
        const ratio = scrollable > 0 ? Math.min(1, wrap.scrollTop / scrollable) : 1
        bar.style.width = `${Math.max(6, ratio * 100)}%`
    }

    function openModal() {
        state.modalFiltered = [...popularMessengers]
        addModal.classList.add('show')
        fillMessengerGrid()
        document.getElementById('modalSearchInput').value = ''
        document.getElementById('customSection').classList.remove('open')
        const wrap = document.getElementById('modalGridWrap')
        if (wrap) wrap.scrollTop = 0
        setTimeout(() => document.getElementById('modalSearchInput').focus(), 100)
    }

    function closeModal() {
        addModal.classList.remove('show')
    }

    return {
        fillMessengerGrid,
        updateScrollProgress,
        openModal,
        closeModal
    }
}

module.exports = {
    createAddModalUiApi
}
