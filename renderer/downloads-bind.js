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
    // Собирает file:// URL из локального пути (в т.ч. Windows-путь с буквой
    // диска и обратными слэшами) — используется для перетаскивания загрузки
    // через 'DownloadURL' (см. dragstart ниже).
    function toFileUrl(filePath) {
        let normalized = String(filePath || '').replace(/\\/g, '/')
        if (!normalized.startsWith('/')) normalized = '/' + normalized
        const segments = normalized.split('/').map((seg, i) => {
            // Сегмент вида "C:" (буква диска) оставляем как есть — иначе
            // encodeURIComponent превратит двоеточие в %3A
            if (i === 1 && /^[a-zA-Z]:$/.test(seg)) return seg
            return encodeURIComponent(seg)
        })
        return 'file://' + segments.join('/')
    }

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

            const draggable = d.state === 'completed' ? ' draggable="true"' : ''

            return `
                <div class="app-notif-item downloads-item" data-id="${escapeHtml(d.id)}" title="${escapeHtml(d.filename)}"${draggable}>
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
            // Перетаскивание файла наружу (в мессенджер-webview, в проводник,
            // в другое приложение). ВАЖНО: изначально было сделано через
            // webContents.startDrag() из main-процесса — это официальный путь
            // Electron для drag-out, НО на Windows он документированно не
            // работает для дропа внутри самого приложения (Electron issue
            // #7118 — doDragDrop() на Windows не разрешает Electron как
            // цель дропа для intra-app drag). Поэтому используем более
            // низкоуровневый механизм — 'DownloadURL' в dataTransfer,
            // тот же приём, которым сам Chrome реализует перетаскивание
            // файла из своей панели загрузок: браузер сам скачивает файл
            // по указанному URL (в нашем случае — file:// на уже скачанный
            // файл) в точку дропа. Это остаётся полностью внутри обычного
            // HTML5 drag-and-drop Chromium, а не уходит в отдельный OS-вызов,
            // поэтому должно корректнее долетать до <webview> в том же окне.
            // Подложка попапов (popup-backdrop-bind.js) перехватывает мышь
            // над webview, пока эта же панель загрузок открыта — на время
            // самого перетаскивания её нужно спрятать, иначе drop не
            // долетит до мессенджера под ней.
            if (el.getAttribute('draggable') === 'true') {
                el.addEventListener('dragstart', (e) => {
                    const d = downloads.find(x => x.id === el.dataset.id)
                    if (!d || d.state !== 'completed' || !d.savePath) {
                        e.preventDefault()
                        return
                    }
                    document.dispatchEvent(new CustomEvent('popup-backdrop-suspend'))
                    const fileUrl = toFileUrl(d.savePath)
                    const mime = 'application/octet-stream'
                    e.dataTransfer.setData('DownloadURL', `${mime}:${d.filename}:${fileUrl}`)
                    e.dataTransfer.effectAllowed = 'copy'
                })
                el.addEventListener('dragend', () => {
                    document.dispatchEvent(new CustomEvent('popup-backdrop-resume'))
                    if (panel.style.display !== 'none') {
                        document.dispatchEvent(new CustomEvent('popup-opened'))
                    }
                })
            }
        })
    }

    // ── Контекстное меню ───────────────────────────────────────────────────────
    function showDownloadContextMenu(e, id) {
        if (!contextMenu) return
        // Не шлём сюда close-all-popups: это меню — дочернее к уже открытой
        // панели загрузок, закрывать саму панель при его открытии не нужно.
        contextTargetId = id
        contextMenu.style.left = `${e.clientX}px`
        contextMenu.style.top = `${e.clientY}px`
        contextMenu.classList.add('show')

        const rect = contextMenu.getBoundingClientRect()
        if (rect.right > window.innerWidth) contextMenu.style.left = `${e.clientX - rect.width}px`
        if (rect.bottom > window.innerHeight) contextMenu.style.top = `${e.clientY - rect.height}px`
        document.dispatchEvent(new CustomEvent('popup-opened'))
    }

    function hideDownloadContextMenu() {
        contextMenu?.classList.remove('show')
        contextTargetId = null
    }

    document.addEventListener('close-all-popups', hideDownloadContextMenu)

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
        document.dispatchEvent(new CustomEvent('close-all-popups'))

        panelOpen = true
        renderPanel()

        const rect = btn.getBoundingClientRect()
        panel.style.left = `${rect.right + 14}px`
        panel.style.top  = '0px'
        panel.style.display = 'flex'

        requestAnimationFrame(() => {
            const pRect = panel.getBoundingClientRect()
            let top = rect.bottom - pRect.height
            if (top < 12) top = 12
            if (top + pRect.height > window.innerHeight - 12) {
                top = window.innerHeight - pRect.height - 12
            }
            panel.style.top = `${Math.max(12, top)}px`
        })

        document.dispatchEvent(new CustomEvent('popup-opened'))
    }

    function closePanel() {
        panelOpen = false
        panel.style.display = 'none'
        hideDownloadContextMenu()
    }

    document.addEventListener('close-all-popups', closePanel)

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
