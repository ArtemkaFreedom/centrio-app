// renderer/split.js — Split-screen mode
// Two messengers side by side with a drag-resize divider.
//
// KEY DESIGN DECISION:
// The picker is appended to document.body as position:fixed.
// This takes it completely outside the webview stacking context —
// Electron webviews can bypass z-index inside their parent container,
// but document.body fixed elements are always clickable above them.
'use strict'

function createSplitApi ({ state, tabsContent, contentArea }) {
    const splitHandle     = document.getElementById('splitHandle')
    const splitPicker     = document.getElementById('splitPicker')
    const splitPickerList = document.getElementById('splitPickerList')
    const splitBtn        = document.getElementById('splitBtn')
    const splitCloseBtn   = document.getElementById('splitCloseBtn')

    // ── Move picker to body so it's above the webview stacking context ────────
    if (splitPicker && splitPicker.parentElement !== document.body) {
        document.body.appendChild(splitPicker)
    }
    if (splitPicker) {
        splitPicker.style.position = 'fixed'
        splitPicker.style.zIndex   = '99999'
        splitPicker.style.display  = 'none'
    }

    // ── Position picker to the right pane (recalculate from contentArea rect) ─

    function _positionPicker () {
        if (!splitPicker || !contentArea) return
        const rect = contentArea.getBoundingClientRect()
        const pct  = (state.splitLeftPct || 50) / 100
        const left = rect.left + rect.width * pct
        splitPicker.style.left   = left + 'px'
        splitPicker.style.top    = rect.top + 'px'
        splitPicker.style.width  = (rect.right - left) + 'px'
        splitPicker.style.height = rect.height + 'px'
        // reset right/bottom so width/height take effect
        splitPicker.style.right  = 'auto'
        splitPicker.style.bottom = 'auto'
    }

    // Reposition on window resize
    window.addEventListener('resize', () => {
        if (state.splitMode && splitPicker?.style.display !== 'none') {
            _positionPicker()
        }
    })

    // ── Helpers ───────────────────────────────────────────────────────────────

    function applyLeft (pct) {
        state.splitLeftPct = pct
        contentArea.style.setProperty('--split-left', pct + '%')
        _applyWebviewInlineStyles(pct)
        _positionPicker()
    }

    function _applyWebviewInlineStyles (pct) {
        const primaryWv = state.activeTabId
            ? document.getElementById(`webview-${state.activeTabId}`) : null
        if (primaryWv) {
            primaryWv.style.right = `calc(100% - ${pct}%)`
            primaryWv.style.left  = '0'
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
            wv.style.right         = ''
            wv.style.left          = ''
            wv.style.width         = ''
            wv.style.pointerEvents = ''
        })
    }

    // Disable pointer events on ALL webviews while picker is showing
    // so they can't intercept clicks even if they bleed beyond CSS bounds
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

        // Disable webview pointer events so nothing can block picker
        _disableWebviewPointerEvents()
    }

    function hidePicker () {
        if (splitPicker) splitPicker.style.display = 'none'
        // Restore webview pointer events
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
        _clearWebviewInlineStyles()
        hidePicker()
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

        hidePicker()  // also restores webview pointer events
        setSplitFocus('right')
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
        // Block webview events during drag so mousemove isn't eaten
        document.querySelectorAll('webview').forEach(wv => {
            wv.style.pointerEvents = 'none'
        })
        e.preventDefault()
        e.stopPropagation()
    })

    document.addEventListener('mousemove', e => {
        if (!_dragging) return
        const rect = contentArea.getBoundingClientRect()
        let pct = ((e.clientX - rect.left) / rect.width) * 100
        pct = Math.max(20, Math.min(80, pct))
        applyLeft(pct)
    })

    document.addEventListener('mouseup', () => {
        if (!_dragging) return
        _dragging = false
        splitHandle?.classList.remove('dragging')
        document.body.style.cursor     = ''
        document.body.style.userSelect = ''
        // Restore webview pointer events (unless picker is open)
        if (splitPicker?.style.display === 'none') {
            _restoreWebviewPointerEvents()
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
