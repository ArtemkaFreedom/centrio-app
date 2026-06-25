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
        // Keep picker aligned to right pane
        if (splitPicker) splitPicker.style.left = pct + '%'
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
            icon.width = 24
            icon.height = 24
            try { icon.src = m.icon || `https://www.google.com/s2/favicons?domain=${new URL(m.url).hostname}&sz=32` }
            catch { icon.src = '' }
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
            const btn = splitBtn
            if (btn) {
                const orig = btn.title
                btn.title = 'Нужен ещё хотя бы один мессенджер'
                setTimeout(() => { btn.title = orig }, 2500)
            }
            return false
        }

        state.splitMode    = true
        state.splitFocus   = 'left'
        state.splitTabId   = null

        contentArea.classList.add('split-active')
        contentArea.dataset.splitFocus = 'left'
        applyLeft(state.splitLeftPct || 50)

        splitBtn?.classList.add('split-active')
        showPicker()
        return true
    }

    function exitSplitMode () {
        // Remove secondary class from previous right-pane webview
        if (state.splitTabId) {
            document.getElementById(`webview-${state.splitTabId}`)?.classList.remove('split-secondary')
        }

        state.splitMode  = false
        state.splitTabId = null
        state.splitFocus = 'left'

        contentArea.classList.remove('split-active')
        delete contentArea.dataset.splitFocus
        splitBtn?.classList.remove('split-active')
        hidePicker()
    }

    // ── Switch secondary (right-pane) tab ────────────────────────────────────

    function switchSplitTab (id) {
        if (id === state.activeTabId) return   // same as primary — ignore

        // Remove previous secondary
        if (state.splitTabId) {
            document.getElementById(`webview-${state.splitTabId}`)?.classList.remove('split-secondary')
        }

        state.splitTabId = id
        document.getElementById(`webview-${id}`)?.classList.add('split-secondary')

        hidePicker()
        setSplitFocus('right')
    }

    // ── Called by renderer.js when primary tab changes ────────────────────────

    function onPrimaryChanged (newPrimaryId) {
        if (!state.splitMode) return
        // If new primary is the same messenger that was secondary — clear secondary
        if (state.splitTabId === newPrimaryId) {
            document.getElementById(`webview-${state.splitTabId}`)?.classList.remove('split-secondary')
            state.splitTabId = null
            showPicker()
        }
        // Refresh picker so disabled item updates
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
        document.body.style.cursor    = 'col-resize'
        document.body.style.userSelect = 'none'
        // Block pointer events on webviews so they don't eat mousemove
        tabsContent.style.pointerEvents = 'none'
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
        tabsContent.style.pointerEvents = 'auto'
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
