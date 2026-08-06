// Менеджер загрузок: список последних загрузок (из главного окна и из
// сессий мессенджеров), с контекстным меню «Показать в папке» / «Открыть файл».
function bindDownloadsUi({
    invokeIpc,
    ipcRenderer,
    tGet
}) {
    const btn          = document.getElementById('downloadsBtn')
    const panel        = document.getElementById('downloadsPanel')
    const badge        = document.getElementById('downloadsBadge')
    const list         = document.getElementById('downloadsList')
    const clearAllBtn  = document.getElementById('downloadsClearAll')
    const contextMenu  = document.getElementById('downloadContextMenu')

    if (!btn || !panel) return {}

    let downloads = []
    let panelOpen = false
    let contextTargetId = null

    // ── Helpers ────────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }

    function formatBytes(n) {
        if (!n || n <= 0) return '0 B'
        const units = ['B', 'KB', 'MB', 'GB']
        let value = n
        let unitIndex = 0
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024
            unitIndex++
        }
        return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
    }

    function formatDate(ms) {
        try {
            const d = new Date(ms)
            const diffMins = Math.floor((Date.now() - ms) / 60000)
            if (diffMins < 1) return tGet('notifications.justNow') || 'just now'
            if (diffMins < 60) return (tGet('notifications.minAgo') || '{n} min ago').replace('{n}', diffMins)
            const diffH = Math.floor(diffMins / 60)
            if (diffH < 24) return (tGet('notifications.hAgo') || '{n} h ago').replace('{n}', diffH)
            return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        } catch { return '' }
    }

    function stateLabel(d) {
        if (d.state === 'progressing') return tGet('downloads.inProgress') || 'Downloading…'
        if (d.state === 'cancelled') return tGet('downloads.cancelled') || 'Cancelled'
        if (d.state === 'interrupted') return tGet('downloads.failed') || 'Failed'
        return tGet('downloads.completed') || 'Completed'
    }

    // ── State ──────────────────────────────────────────────────────────────────
    function upsert(record) {
        if (!record || !record.id) return
        const idx = downloads.findIndex(d => d.id === record.id)
        if (idx === -1) downloads.unshift(record)
        else downloads[idx] = record
        updateBadge()
        if (panelOpen) renderPanel()
    }

    function updateBadge() {
        if (!badge) return
        const active = downloads.filter(d => d.state === 'progressing').length
        if (active > 0) {
            badge.textContent = active > 99 ? '99+' : String(active)
            badge.style.display = 'flex'
        } else {
            badge.style.display = 'none'
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    function renderPanel() {
        if (!list) return

        if (!downloads.length) {
            list.innerHTML = `<div class="app-notif-empty">${tGet('downloads.empty') || 'No downloads yet'}</div>`
            return
        }

        list.innerHTML = downloads.map(d => {
            const pct = d.totalBytes > 0
                ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100))
                : 0

            const progressHtml = d.state === 'progressing'
                ? `<div class="downloads-progress-track"><div class="downloads-progress-fill" style="width:${pct}%"></div></div>`
                : ''

            const bodyText = d.state === 'progressing'
                ? `${formatBytes(d.receivedBytes)} / ${d.totalBytes > 0 ? formatBytes(d.totalBytes) : '?'}`
                : stateLabel(d)

            return `
                <div class="app-notif-item downloads-item" data-id="${escapeHtml(d.id)}" title="${escapeHtml(d.filename)}">
                    <div class="app-notif-item-title">${escapeHtml(d.filename)}</div>
                    ${progressHtml}
                    <div class="app-notif-item-body">${escapeHtml(bodyText)}</div>
                    <div class="app-notif-item-time">${formatDate(d.startTime)}</div>
                </div>
            `
        }).join('')

        list.querySelectorAll('.downloads-item').forEach(el => {
            el.addEventListener('click', () => {
                const d = downloads.find(x => x.id === el.dataset.id)
                if (d && d.state === 'completed') invokeIpc('downloads:open-file', d.id)
            })
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault()
                e.stopPropagation()
                showDownloadContextMenu(e, el.dataset.id)
            })
        })
    }

    // ── Контекстное меню ───────────────────────────────────────────────────────
    function showDownloadContextMenu(e, id) {
        if (!contextMenu) return
        contextTargetId = id
        contextMenu.style.left = `${e.clientX}px`
        contextMenu.style.top = `${e.clientY}px`
        contextMenu.classList.add('show')

        const rect = contextMenu.getBoundingClientRect()
        if (rect.right > window.innerWidth) contextMenu.style.left = `${e.clientX - rect.width}px`
        if (rect.bottom > window.innerHeight) contextMenu.style.top = `${e.clientY - rect.height}px`
    }

    function hideDownloadContextMenu() {
        contextMenu?.classList.remove('show')
        contextTargetId = null
    }

    document.getElementById('ctxDownloadShowInFolder')?.addEventListener('click', () => {
        if (contextTargetId) ipcRenderer.send('downloads:show-in-folder', contextTargetId)
        hideDownloadContextMenu()
    })

    document.getElementById('ctxDownloadOpenFile')?.addEventListener('click', () => {
        if (contextTargetId) invokeIpc('downloads:open-file', contextTargetId)
        hideDownloadContextMenu()
    })

    document.getElementById('ctxDownloadRemove')?.addEventListener('click', () => {
        if (contextTargetId) {
            ipcRenderer.send('downloads:remove', contextTargetId)
            downloads = downloads.filter(d => d.id !== contextTargetId)
            updateBadge()
            renderPanel()
        }
        hideDownloadContextMenu()
    })

    // ── Панель open/close ──────────────────────────────────────────────────────
    function openPanel() {
        panelOpen = true
        renderPanel()

        const rect = btn.getBoundingClientRect()
        panel.style.left = `${rect.right + 8}px`
        panel.style.top  = '0px'
        panel.style.display = 'flex'

        requestAnimationFrame(() => {
            const pRect = panel.getBoundingClientRect()
            let top = rect.bottom - pRect.height
            if (top < 8) top = 8
            if (top + pRect.height > window.innerHeight - 8) {
                top = window.innerHeight - pRect.height - 8
            }
            panel.style.top = `${Math.max(8, top)}px`
        })
    }

    function closePanel() {
        panelOpen = false
        panel.style.display = 'none'
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (panel.style.display === 'none' || !panel.style.display) {
            openPanel()
        } else {
            closePanel()
        }
    })

    clearAllBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        ipcRenderer.send('downloads:clear')
        downloads = []
        updateBadge()
        renderPanel()
    })

    document.addEventListener('click', (e) => {
        if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) {
            closePanel()
        }
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideDownloadContextMenu()
        }
    })

    ipcRenderer.on('downloads:item-update', (record) => upsert(record))

    ;(async () => {
        const history = await invokeIpc('downloads:get-history').catch(() => [])
        downloads = Array.isArray(history) ? history : []
        updateBadge()
    })()

    return { upsert }
}

module.exports = { bindDownloadsUi }
