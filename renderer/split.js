// renderer/split.js — Split-screen mode
// Two messengers side by side with a drag-resize divider.
//
// ARCHITECTURE NOTE:
// Both #splitHandle and #splitPicker are appended to document.body as
// position:fixed elements. This is the only reliable way to make them
// receive pointer events above Electron webviews, which intercept all
// mouse input within their bounds regardless of CSS z-index.
'use strict'

// Раскладки-сетки (доп. к классическому 2col выше) — прямоугольники в % от
// #contentArea. Зона 0 всегда зеркалит activeTabId (та же конвенция, что и
// "левая панель" в 2col), остальные зоны назначаются через мини-попап.
const GRID_LAYOUTS = {
    '3col': [
        { left: 0,      top: 0, width: 33.34, height: 100 },
        { left: 33.34,  top: 0, width: 33.33, height: 100 },
        { left: 66.67,  top: 0, width: 33.33, height: 100 }
    ],
    '2x2': [
        { left: 0,  top: 0,  width: 50, height: 50 },
        { left: 50, top: 0,  width: 50, height: 50 },
        { left: 0,  top: 50, width: 50, height: 50 },
        { left: 50, top: 50, width: 50, height: 50 }
    ]
}

function createSplitApi ({ state, tabsContent, contentArea, store }) {
    const splitHandle     = document.getElementById('splitHandle')
    const splitPicker     = document.getElementById('splitPicker')
    const splitPickerList = document.getElementById('splitPickerList')
    const splitBtn        = document.getElementById('splitBtn')
    const splitCloseBtn   = document.getElementById('splitCloseBtn')

    // ── Сетка-раскладки: доп. DOM-узлы ─────────────────────────────────────────
    const splitLayoutPicker   = document.getElementById('splitLayoutPicker')
    const splitZones          = document.getElementById('splitZones')
    const splitZonePicker     = document.getElementById('splitZonePicker')
    const splitZonePickerList = document.getElementById('splitZonePickerList')

    // ── Hoist both handle and picker to document.body ─────────────────────────
    //    Electron webviews eat pointer events inside their stacking context.
    //    position:fixed children of body are always above them.

    if (splitHandle && splitHandle.parentElement !== document.body) {
        document.body.appendChild(splitHandle)
    }
    if (splitHandle) {
        splitHandle.style.position = 'fixed'
        splitHandle.style.zIndex   = '99998'
        splitHandle.style.display  = 'none'
    }

    if (splitPicker && splitPicker.parentElement !== document.body) {
        document.body.appendChild(splitPicker)
    }
    if (splitPicker) {
        splitPicker.style.position = 'fixed'
        splitPicker.style.zIndex   = '99999'
        splitPicker.style.display  = 'none'
    }

    ;[splitLayoutPicker, splitZones, splitZonePicker].forEach(el => {
        if (!el) return
        if (el.parentElement !== document.body) document.body.appendChild(el)
        el.style.position = 'fixed'
        el.style.zIndex   = '99999'
    })

    // ── Position helpers (recalculate from contentArea live rect) ─────────────

    function _positionHandle () {
        if (!splitHandle || !contentArea) return
        const rect  = contentArea.getBoundingClientRect()
        const pct   = (state.splitLeftPct || 50) / 100
        const centerX = rect.left + rect.width * pct
        splitHandle.style.left   = (centerX - 3) + 'px'
        splitHandle.style.top    = rect.top + 'px'
        splitHandle.style.width  = '6px'
        splitHandle.style.height = rect.height + 'px'
        splitHandle.style.right  = 'auto'
        splitHandle.style.bottom = 'auto'
    }

    function _positionPicker () {
        if (!splitPicker || !contentArea) return
        const rect  = contentArea.getBoundingClientRect()
        const pct   = (state.splitLeftPct || 50) / 100
        const leftX = rect.left + rect.width * pct
        splitPicker.style.left   = leftX + 'px'
        splitPicker.style.top    = rect.top + 'px'
        splitPicker.style.width  = (rect.right - leftX) + 'px'
        splitPicker.style.height = rect.height + 'px'
        splitPicker.style.right  = 'auto'
        splitPicker.style.bottom = 'auto'
    }

    window.addEventListener('resize', () => {
        if (!state.splitMode) return
        if (state.splitLayout === '2col') {
            _positionHandle()
            if (splitPicker?.style.display !== 'none') _positionPicker()
        } else {
            renderGridZones()
        }
    })

    // ── Сетка-раскладки: helpers ────────────────────────────────────────────────

    function _zoneRectToPx (rect) {
        const car = contentArea.getBoundingClientRect()
        return {
            left:   car.left + car.width  * (rect.left   / 100),
            top:    car.top  + car.height * (rect.top    / 100),
            width:  car.width  * (rect.width  / 100),
            height: car.height * (rect.height / 100)
        }
    }

    function _clearGridWebviewStyles () {
        document.querySelectorAll('webview').forEach(wv => {
            wv.classList.remove('split-grid-tile')
            wv.style.left = wv.style.top = wv.style.right = wv.style.bottom = ''
            wv.style.width = wv.style.height = ''
        })
    }

    function _applyGridZoneWebview (zoneIndex, messengerId) {
        const zones = GRID_LAYOUTS[state.splitLayout]
        const rect  = zones && zones[zoneIndex]
        const wv    = messengerId ? document.getElementById(`webview-${messengerId}`) : null
        if (!rect || !wv) return

        if (zoneIndex !== 0) wv.classList.add('split-grid-tile')
        wv.style.left   = rect.left + '%'
        wv.style.top    = rect.top + '%'
        wv.style.width  = rect.width + '%'
        wv.style.height = rect.height + '%'
        wv.style.right  = 'auto'
        wv.style.bottom = 'auto'
    }

    function _clearGridZoneWebview (messengerId) {
        const wv = messengerId ? document.getElementById(`webview-${messengerId}`) : null
        if (!wv) return
        wv.classList.remove('split-grid-tile')
        wv.style.left = wv.style.top = wv.style.right = wv.style.bottom = ''
        wv.style.width = wv.style.height = ''
    }

    function renderGridZones () {
        if (!splitZones) return
        splitZones.innerHTML = ''
        const zones = GRID_LAYOUTS[state.splitLayout]
        if (!zones) return

        zones.forEach((rect, i) => {
            // Зона 0 — основная вкладка, видна сама по себе через .active,
            // отдельного плейсхолдера/рамки не получает.
            if (i === 0) return

            const px = _zoneRectToPx(rect)
            const messengerId = state.splitZoneIds[i]
            const messenger = messengerId ? state.activeMessengers.find(m => m.id === messengerId) : null

            if (messenger) {
                const frame = document.createElement('div')
                frame.className = 'split-zone-tile' + (state.splitZoneFocus === i ? ' focused' : '')
                frame.style.left   = `${px.left}px`
                frame.style.top    = `${px.top}px`
                frame.style.width  = `${px.width}px`
                frame.style.height = `${px.height}px`
                frame.style.pointerEvents = 'none'
                splitZones.appendChild(frame)
            } else {
                const placeholder = document.createElement('div')
                placeholder.className = 'split-zone-placeholder'
                placeholder.style.left   = `${px.left}px`
                placeholder.style.top    = `${px.top}px`
                placeholder.style.width  = `${px.width}px`
                placeholder.style.height = `${px.height}px`
                placeholder.innerHTML = `
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <span>Выбрать мессенджер</span>
                `
                placeholder.addEventListener('click', () => showZonePicker(i))
                splitZones.appendChild(placeholder)
            }
        })
    }

    function setGridZoneFocus (zoneIndex) {
        if (state.splitZoneFocus === zoneIndex) return
        state.splitZoneFocus = zoneIndex
        renderGridZones()
    }

    function _persistGridSplit () {
        store?.set?.('split.saved', {
            layout: state.splitLayout,
            zoneIds: state.splitZoneIds,
            splitLeftPct: state.splitLeftPct || 50
        })
    }

    function switchGridZone (zoneIndex, messengerId) {
        if (zoneIndex === 0 || !messengerId) return

        // Если этот мессенджер уже занимал другую зону — освобождаем её
        state.splitZoneIds.forEach((id, i) => {
            if (i !== zoneIndex && id === messengerId) {
                state.splitZoneIds[i] = null
                _clearGridZoneWebview(id)
            }
        })

        // Снимаем предыдущее назначение самой зоны
        const prevId = state.splitZoneIds[zoneIndex]
        if (prevId && prevId !== messengerId) _clearGridZoneWebview(prevId)

        state.splitZoneIds[zoneIndex] = messengerId
        _applyGridZoneWebview(zoneIndex, messengerId)
        hideZonePicker()
        state.splitZoneFocus = zoneIndex
        renderGridZones()
        _persistGridSplit()
    }

    // ── Мини-попап выбора мессенджера для одной зоны ────────────────────────────

    function showZonePicker (zoneIndex) {
        if (!splitZonePicker || !splitZonePickerList) return
        document.dispatchEvent(new CustomEvent('close-all-popups'))

        splitZonePickerList.innerHTML = ''
        state.activeMessengers.forEach(m => {
            const item = document.createElement('button')
            item.type      = 'button'
            item.className = 'split-picker-item'

            if (m.id === state.splitZoneIds[0]) {
                item.classList.add('is-primary')
                item.disabled = true
            }

            const icon = document.createElement('img')
            icon.width  = 44
            icon.height = 44
            try {
                icon.src = m.icon ||
                    `https://www.google.com/s2/favicons?domain=${new URL(m.url).hostname}&sz=64`
            } catch { icon.src = '' }
            icon.onerror = () => { icon.style.display = 'none' }

            const name = document.createElement('span')
            name.textContent = m.name

            item.appendChild(icon)
            item.appendChild(name)
            item.addEventListener('click', () => {
                if (!item.disabled) switchGridZone(zoneIndex, m.id)
            })
            splitZonePickerList.appendChild(item)
        })

        const zones = GRID_LAYOUTS[state.splitLayout]
        const px = zones ? _zoneRectToPx(zones[zoneIndex]) : null
        splitZonePicker.style.display = 'block'
        if (px) {
            splitZonePicker.style.left = `${px.left + px.width / 2 - 130}px`
            splitZonePicker.style.top  = `${px.top + px.height / 2 - 80}px`
        }

        requestAnimationFrame(() => {
            const rect = splitZonePicker.getBoundingClientRect()
            let left = parseFloat(splitZonePicker.style.left) || 0
            let top  = parseFloat(splitZonePicker.style.top) || 0
            if (left < 8) left = 8
            if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8
            if (top < 8) top = 8
            if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8
            splitZonePicker.style.left = `${left}px`
            splitZonePicker.style.top  = `${top}px`
        })

        document.dispatchEvent(new CustomEvent('popup-opened'))
    }

    function hideZonePicker () {
        if (splitZonePicker) splitZonePicker.style.display = 'none'
    }

    document.addEventListener('close-all-popups', hideZonePicker)

    // ── Выбор раскладки (2col / 3col / 2x2) ──────────────────────────────────────

    function showLayoutPicker () {
        if (!splitLayoutPicker || !splitBtn) return
        if (state.activeMessengers.length < 2) {
            const orig = splitBtn.title
            splitBtn.title = 'Нужен ещё хотя бы один мессенджер'
            setTimeout(() => { splitBtn.title = orig }, 2500)
            return
        }
        document.dispatchEvent(new CustomEvent('close-all-popups'))

        const rect = splitBtn.getBoundingClientRect()
        splitLayoutPicker.style.display = 'block'
        splitLayoutPicker.style.left = `${rect.right + 10}px`
        splitLayoutPicker.style.top  = '0px'

        requestAnimationFrame(() => {
            const pRect = splitLayoutPicker.getBoundingClientRect()
            let top = rect.bottom - pRect.height
            if (top < 10) top = 10
            if (top + pRect.height > window.innerHeight - 10) top = window.innerHeight - pRect.height - 10
            splitLayoutPicker.style.top = `${Math.max(10, top)}px`
        })

        document.dispatchEvent(new CustomEvent('popup-opened'))
    }

    function hideLayoutPicker () {
        if (splitLayoutPicker) splitLayoutPicker.style.display = 'none'
    }

    document.addEventListener('close-all-popups', hideLayoutPicker)

    splitLayoutPicker?.querySelectorAll('.split-layout-option').forEach(optionBtn => {
        optionBtn.addEventListener('click', () => {
            const layout = optionBtn.dataset.layout
            hideLayoutPicker()
            if (layout === '2col') enterSplitMode()
            else enterGridSplitMode(layout)
        })
    })

    // ── Вход в сетку-раскладку ────────────────────────────────────────────────

    function enterGridSplitMode (layout) {
        const zones = GRID_LAYOUTS[layout]
        if (!zones) return false
        if (state.activeMessengers.length < 2) {
            if (splitBtn) {
                const orig = splitBtn.title
                splitBtn.title = 'Нужен ещё хотя бы один мессенджер'
                setTimeout(() => { splitBtn.title = orig }, 2500)
            }
            return false
        }

        state.splitMode      = true
        state.splitLayout    = layout
        state.splitZoneFocus = 0
        state.splitZoneIds   = new Array(zones.length).fill(null)
        state.splitZoneIds[0] = state.activeTabId

        contentArea.classList.add('split-active', 'split-grid')
        splitBtn?.classList.add('split-active')

        _applyGridZoneWebview(0, state.activeTabId)
        renderGridZones()
        return true
    }

    // ── Core helpers ──────────────────────────────────────────────────────────

    function applyLeft (pct) {
        state.splitLeftPct = pct
        contentArea.style.setProperty('--split-left', pct + '%')
        _applyWebviewInlineStyles(pct)
        _positionHandle()
        if (splitPicker?.style.display !== 'none') _positionPicker()
    }

    function _applyWebviewInlineStyles (pct) {
        const primaryWv = state.activeTabId
            ? document.getElementById(`webview-${state.activeTabId}`) : null
        if (primaryWv) {
            primaryWv.style.left  = '0'
            primaryWv.style.right = `calc(100% - ${pct}%)`
            primaryWv.style.width = 'auto'
        }
        const secondaryWv = state.splitTabId
            ? document.getElementById(`webview-${state.splitTabId}`) : null
        if (secondaryWv) {
            secondaryWv.style.left  = pct + '%'
            secondaryWv.style.right = '0'
            secondaryWv.style.width = 'auto'
        }
    }

    function _clearWebviewInlineStyles () {
        document.querySelectorAll('webview').forEach(wv => {
            wv.style.left          = ''
            wv.style.right         = ''
            wv.style.width         = ''
            wv.style.pointerEvents = ''
        })
    }

    function _disableWebviewPointerEvents () {
        document.querySelectorAll('webview').forEach(wv => {
            wv.style.pointerEvents = 'none'
        })
    }

    function _restoreWebviewPointerEvents () {
        document.querySelectorAll('webview').forEach(wv => {
            wv.style.pointerEvents = ''
        })
    }

    function setSplitFocus (side) {
        state.splitFocus = side
        contentArea.dataset.splitFocus = side
    }

    // ── Picker ────────────────────────────────────────────────────────────────

    function showPicker () {
        if (!splitPicker || !splitPickerList) return

        splitPickerList.innerHTML = ''
        state.activeMessengers.forEach(m => {
            const item = document.createElement('button')
            item.type      = 'button'
            item.className = 'split-picker-item'

            if (m.id === state.activeTabId) {
                item.classList.add('is-primary')
                item.disabled = true
            }

            const icon = document.createElement('img')
            icon.width  = 44
            icon.height = 44
            try {
                icon.src = m.icon ||
                    `https://www.google.com/s2/favicons?domain=${new URL(m.url).hostname}&sz=64`
            } catch { icon.src = '' }
            icon.onerror = () => { icon.style.display = 'none' }

            const name = document.createElement('span')
            name.textContent = m.name

            item.appendChild(icon)
            item.appendChild(name)
            item.addEventListener('click', () => { if (!item.disabled) switchSplitTab(m.id) })
            splitPickerList.appendChild(item)
        })

        _positionPicker()
        splitPicker.style.display = 'flex'
        _disableWebviewPointerEvents()
    }

    function hidePicker () {
        if (splitPicker) splitPicker.style.display = 'none'
        _restoreWebviewPointerEvents()
    }

    // ── Enter / exit ──────────────────────────────────────────────────────────

    function enterSplitMode () {
        if (state.activeMessengers.length < 2) {
            if (splitBtn) {
                const orig = splitBtn.title
                splitBtn.title = 'Нужен ещё хотя бы один мессенджер'
                setTimeout(() => { splitBtn.title = orig }, 2500)
            }
            return false
        }

        state.splitMode   = true
        state.splitLayout = '2col'
        state.splitFocus  = 'left'
        state.splitTabId  = null

        contentArea.classList.add('split-active')
        contentArea.dataset.splitFocus = 'left'

        if (splitHandle) splitHandle.style.display = 'block'
        applyLeft(state.splitLeftPct || 50)

        splitBtn?.classList.add('split-active')
        showPicker()
        return true
    }

    function exitSplitMode () {
        if (state.splitLayout === '2col') {
            if (state.splitTabId) {
                const wv = document.getElementById(`webview-${state.splitTabId}`)
                wv?.classList.remove('split-secondary')
            }
            _clearWebviewInlineStyles()
            hidePicker()
        } else {
            _clearGridWebviewStyles()
            hideZonePicker()
            if (splitZones) splitZones.innerHTML = ''
        }

        state.splitMode       = false
        state.splitTabId      = null
        state.splitFocus      = 'left'
        state.splitLayout     = '2col'
        state.splitZoneIds    = []
        state.splitZoneFocus  = 0

        contentArea.classList.remove('split-active', 'split-grid')
        delete contentArea.dataset.splitFocus
        splitBtn?.classList.remove('split-active')

        if (splitHandle) splitHandle.style.display = 'none'
        hideLayoutPicker()

        // Сбрасываем сохранённое состояние
        store?.delete?.('split.saved')
    }

    // ── Switch secondary tab ──────────────────────────────────────────────────

    function switchSplitTab (id) {
        if (id === state.activeTabId) return

        if (state.splitTabId) {
            const prev = document.getElementById(`webview-${state.splitTabId}`)
            if (prev) {
                prev.classList.remove('split-secondary')
                prev.style.left = prev.style.right = prev.style.width = ''
            }
        }

        state.splitTabId = id
        const wv = document.getElementById(`webview-${id}`)
        if (wv) {
            wv.classList.add('split-secondary')
            const pct = state.splitLeftPct || 50
            wv.style.left  = pct + '%'
            wv.style.right = '0'
            wv.style.width = 'auto'
        }

        hidePicker()
        setSplitFocus('right')

        // Сохраняем состояние в store
        store?.set?.('split.saved', { splitTabId: id, splitLeftPct: state.splitLeftPct || 50 })
    }

    // ── Callbacks from renderer.js ────────────────────────────────────────────

    function onPrimaryChanged (newPrimaryId) {
        if (!state.splitMode) return

        if (state.splitLayout !== '2col') {
            const oldPrimaryId = state.splitZoneIds[0]
            if (oldPrimaryId && oldPrimaryId !== newPrimaryId) _clearGridZoneWebview(oldPrimaryId)

            // Если новый primary уже занимал другую зону — освобождаем её
            state.splitZoneIds.forEach((zid, i) => {
                if (i !== 0 && zid === newPrimaryId) state.splitZoneIds[i] = null
            })

            state.splitZoneIds[0] = newPrimaryId
            _applyGridZoneWebview(0, newPrimaryId)
            renderGridZones()
            return
        }

        if (state.splitTabId === newPrimaryId) {
            const wv = document.getElementById(`webview-${state.splitTabId}`)
            if (wv) {
                wv.classList.remove('split-secondary')
                wv.style.left = wv.style.right = wv.style.width = ''
            }
            state.splitTabId = null
            showPicker()
        }
        _applyWebviewInlineStyles(state.splitLeftPct || 50)
        if (splitPicker?.style.display !== 'none') showPicker()
    }

    function onMessengerRemoved (id) {
        if (!state.splitMode) return

        if (state.splitLayout !== '2col') {
            let changed = false
            state.splitZoneIds.forEach((zid, i) => {
                if (zid === id) {
                    state.splitZoneIds[i] = null
                    changed = true
                }
            })
            if (changed) renderGridZones()
            return
        }

        if (state.splitTabId === id) {
            state.splitTabId = null
            if (state.activeMessengers.length >= 2) showPicker()
            else exitSplitMode()
        }
    }

    // ── Drag resize ───────────────────────────────────────────────────────────

    let _dragging = false

    splitHandle?.addEventListener('mousedown', e => {
        _dragging = true
        splitHandle.classList.add('dragging')
        document.body.style.cursor     = 'col-resize'
        document.body.style.userSelect = 'none'
        // Block webview pointer events during drag
        _disableWebviewPointerEvents()
        e.preventDefault()
        e.stopPropagation()
    })

    document.addEventListener('mousemove', e => {
        if (!_dragging) return
        const rect = contentArea.getBoundingClientRect()
        let pct = ((e.clientX - rect.left) / rect.width) * 100
        pct = Math.max(15, Math.min(85, pct))
        applyLeft(pct)
    })

    document.addEventListener('mouseup', () => {
        if (!_dragging) return
        _dragging = false
        splitHandle?.classList.remove('dragging')
        document.body.style.cursor     = ''
        document.body.style.userSelect = ''
        // Restore pointer events (unless picker is still open)
        if (splitPicker?.style.display === 'none') {
            _restoreWebviewPointerEvents()
        }
        // Обновляем сохранённый pct после перетаскивания
        if (state.splitMode && state.splitTabId) {
            store?.set?.('split.saved', { splitTabId: state.splitTabId, splitLeftPct: state.splitLeftPct || 50 })
        }
    })

    // ── Button wiring ─────────────────────────────────────────────────────────

    splitBtn?.addEventListener('click', () => {
        if (state.splitMode) {
            exitSplitMode()
        } else {
            showLayoutPicker()
        }
    })

    splitCloseBtn?.addEventListener('click', () => exitSplitMode())

    // ── Focus tracking ────────────────────────────────────────────────────────

    function onWebviewFocus (webview) {
        if (!state.splitMode) return

        if (state.splitLayout !== '2col') {
            const messengerId = webview.id.replace('webview-', '')
            const zoneIndex = state.splitZoneIds.indexOf(messengerId)
            if (zoneIndex !== -1) setGridZoneFocus(zoneIndex)
            return
        }

        setSplitFocus(webview.classList.contains('split-secondary') ? 'right' : 'left')
    }

    return {
        enterSplitMode,
        enterGridSplitMode,
        exitSplitMode,
        switchSplitTab,
        switchGridZone,
        setSplitFocus,
        setGridZoneFocus,
        showPicker,
        showLayoutPicker,
        onPrimaryChanged,
        onMessengerRemoved,
        onWebviewFocus
    }
}

module.exports = { createSplitApi }
