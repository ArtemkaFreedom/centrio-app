// renderer/split.js — Split-screen mode
// Two messengers side by side with a drag-resize divider.
'use strict'

function createSplitApi ({ state, tabsContent, contentArea }) {
    const splitHandle     = document.getElementById('splitHandle')
    const splitPicker     = document.getElementById('splitPicker')
    const splitPickerList = document.getElementById('splitPickerList')
    const splitBtn        = document.getElementById('splitBtn')
    const splitCloseBtn   = document.getElementById('splitCloseBtn')

    // ── Helpers ───────────────────────────────────────────────────────────────

    function applyLeft (pct) {
        state.splitLeftPct = pct
        contentArea.style.setProperty('--split-left', pct + '%')
        // Sync picker position (it reads from CSS var but update left directly too)
        if (splitPicker) splitPicker.style.left = pct + '%'
        // Belt-and-suspenders: also set inline style on active webview
        // (Electron webviews can ignore CSS constraints in some cases)
        _applyWebviewInlineStyles(pct)
    }

    function _applyWebviewInlineStyles (pct) {
        // Primary: constrain to left side
        const primaryWv = state.activeTabId
            ? document.getElementById(`webview-${state.activeTabId}`)
            : null
        if (primaryWv) {
            primaryWv.style.right = `calc(100% - ${pct}%)`
            primaryWv.style.width = 'auto'
        }
        // Secondary: constrain to right side
        const secondaryWv = state.splitTabId
            ? document.getElementById(`webview-${state.splitTabId}`)
            : null
        if (secondaryWv) {
            secondaryWv.style.left  = pct + '%'
            secondaryWv.style.right = '0'
            secondaryWv.style.width = 'auto'
        }
    }

    function _clearWebviewInlineStyles () {
        document.querySelectorAll('webview').forEach(wv => {
            wv.style.right = ''
            wv.style.left  = ''
            wv.style.width = ''
        })
    }

    function setSplitFocus (side) {
        state.splitFocus = side
        contentArea.dataset.splitFocus = side
    }

    // ── Picker (right-pane messenger selector) ────────────────────────────────

    function showPicker () {
        if (!splitPicker || !splitPickerList) return

        splitPickerList.innerHTML = ''
        state.activeMessengers.forEach(m => {
            const item = document.createElement('button')
            item.type = 'button'
            item.className = 'split-picker-item'

            // Disable the one already in the left pane
            if (m.id === state.activeTabId) {
                item.classList.add('is-primary')
                item.disabled = true
            }

            const icon = document.createElement('img')
            icon.width  = 44
            icon.height = 44
            try {
                icon.src = m.icon || `https://www.google.com/s2/favicons?domain=${new URL(m.url).hostname}&sz=64`
            } catch { icon.src = '' }
            icon.onerror = () => { icon.style.display = 'none' }

            const name = document.createElement('span')
            name.textContent = m.name

            item.appendChild(icon)
            item.appendChild(name)
            item.addEventListener('click', () => { if (!item.disabled) switchSplitTab(m.id) })
            splitPickerList.appendChild(item)
        })

        splitPicker.style.display = 'flex'
    }

    function hidePicker () {
        if (splitPicker) splitPicker.style.display = 'none'
    }

    // ── Enter / exit split mode ───────────────────────────────────────────────

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
        // Remove secondary class + inline styles from right-pane webview
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

    // ── Switch secondary (right-pane) tab ────────────────────────────────────

    function switchSplitTab (id) {
        if (id === state.activeTabId) return   // same as primary — ignore

        // Remove previous secondary
        if (state.splitTabId) {
            const prev = document.getElementById(`webview-${state.splitTabId}`)
            if (prev) {
                prev.classList.remove('split-secondary')
                prev.style.left  = ''
                prev.style.right = ''
                prev.style.width = ''
            }
        }

        state.splitTabId = id
        const wv = document.getElementById(`webview-${id}`)
        if (wv) {
            wv.classList.add('split-secondary')
            // Inline style to ensure Electron webview respects the boundary
            const pct = state.splitLeftPct || 50
            wv.style.left  = pct + '%'
            wv.style.right = '0'
            wv.style.width = 'auto'
        }

        hidePicker()
        setSplitFocus('right')
    }

    // ── Called by renderer.js when primary tab changes ────────────────────────

    function onPrimaryChanged (newPrimaryId) {
        if (!state.splitMode) return
        // If new primary is same as secondary — clear secondary
        if (state.splitTabId === newPrimaryId) {
            const wv = document.getElementById(`webview-${state.splitTabId}`)
            if (wv) {
                wv.classList.remove('split-secondary')
                wv.style.left = wv.style.right = wv.style.width = ''
            }
            state.splitTabId = null
            showPicker()
        }
        // Re-apply inline styles for new primary webview
        _applyWebviewInlineStyles(state.splitLeftPct || 50)
        // Refresh picker disabled state
        if (splitPicker?.style.display !== 'none') showPicker()
    }

    // ── Called by renderer.js when a messenger is removed ────────────────────

    function onMessengerRemoved (id) {
        if (!state.splitMode) return
        if (state.splitTabId === id) {
            state.splitTabId = null
            if (state.activeMessengers.length >= 2) {
                showPicker()
            } else {
                exitSplitMode()
            }
        }
    }

    // ── Drag resize ───────────────────────────────────────────────────────────

    let _dragging = false

    splitHandle?.addEventListener('mousedown', e => {
        _dragging = true
        splitHandle.classList.add('dragging')
        document.body.style.cursor     = 'col-resize'
        document.body.style.userSelect = 'none'
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
    })

    // ── Button wiring ─────────────────────────────────────────────────────────

    splitBtn?.addEventListener('click', () => {
        state.splitMode ? exitSplitMode() : enterSplitMode()
    })

    splitCloseBtn?.addEventListener('click', () => exitSplitMode())

    // ── Focus tracking (called from webview focus events) ─────────────────────

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
