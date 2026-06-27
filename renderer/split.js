// renderer/split.js — Split-screen mode
// Two messengers side by side with a drag-resize divider.
//
// ARCHITECTURE NOTE:
// Both #splitHandle and #splitPicker are appended to document.body as
// position:fixed elements. This is the only reliable way to make them
// receive pointer events above Electron webviews, which intercept all
// mouse input within their bounds regardless of CSS z-index.
'use strict'

function createSplitApi ({ state, tabsContent, contentArea, store }) {
    const splitHandle     = document.getElementById('splitHandle')
    const splitPicker     = document.getElementById('splitPicker')
    const splitPickerList = document.getElementById('splitPickerList')
    const splitBtn        = document.getElementById('splitBtn')
    const splitCloseBtn   = document.getElementById('splitCloseBtn')

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
        _positionHandle()
        if (splitPicker?.style.display !== 'none') _positionPicker()
    })

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

        state.splitMode  = true
        state.splitFocus = 'left'
        state.splitTabId = null

        contentArea.classList.add('split-active')
        contentArea.dataset.splitFocus = 'left'

        if (splitHandle) splitHandle.style.display = 'block'
        applyLeft(state.splitLeftPct || 50)

        splitBtn?.classList.add('split-active')
        showPicker()
        return true
    }

    function exitSplitMode () {
        if (state.splitTabId) {
            const wv = document.getElementById(`webview-${state.splitTabId}`)
            wv?.classList.remove('split-secondary')
        }

        state.splitMode  = false
        state.splitTabId = null
        state.splitFocus = 'left'

        contentArea.classList.remove('split-active')
        delete contentArea.dataset.splitFocus
        splitBtn?.classList.remove('split-active')

        if (splitHandle) splitHandle.style.display = 'none'
        _clearWebviewInlineStyles()
        hidePicker()

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
        state.splitMode ? exitSplitMode() : enterSplitMode()
    })

    splitCloseBtn?.addEventListener('click', () => exitSplitMode())

    // ── Focus tracking ────────────────────────────────────────────────────────

    function onWebviewFocus (webview) {
        if (!state.splitMode) return
        setSplitFocus(webview.classList.contains('split-secondary') ? 'right' : 'left')
    }

    return {
        enterSplitMode,
        exitSplitMode,
        switchSplitTab,
        setSplitFocus,
        showPicker,
        onPrimaryChanged,
        onMessengerRemoved,
        onWebviewFocus
    }
}

module.exports = { createSplitApi }
