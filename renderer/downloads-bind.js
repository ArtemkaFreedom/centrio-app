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
    // Превью картинки в списке загрузок — как в браузере: для завершённых
    // загрузок изображений показываем реальную миниатюру (file:// на уже
    // скачанный файл), для остального — универсальную иконку документа.
    const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg|ico|avif)$/i

    function isImageFile(filename) {
        return IMAGE_EXT_RE.test(filename || '')
    }

    function toFileUrl(filePath) {
        let normalized = String(filePath || '').replace(/\\/g, '/')
        if (!normalized.startsWith('/')) normalized = '/' + normalized
        const segments = normalized.split('/').map((seg, i) => {
            // Буква диска ("C:") остаётся как есть — иначе encodeURIComponent
            // превратит двоеточие в %3A и получится невалидный file:// URL
            if (i === 1 && /^[a-zA-Z]:$/.test(seg)) return seg
            return encodeURIComponent(seg)
        })
        return 'file://' + segments.join('/')
    }

    const GENERIC_FILE_ICON = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `

    function thumbnailHtml(d) {
        if (d.state === 'completed' && d.savePath && isImageFile(d.filename)) {
            const url = toFileUrl(d.savePath)
            return `<img class="downloads-thumb" data-image-thumb="1" src="${escapeHtml(url)}" alt="">`
        }
        return `<div class="downloads-thumb downloads-thumb-generic">${GENERIC_FILE_ICON}</div>`
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

            return `
                <div class="app-notif-item downloads-item" data-id="${escapeHtml(d.id)}" title="${escapeHtml(d.filename)}">
                    <div class="downloads-item-row">
                        ${thumbnailHtml(d)}
                        <div class="downloads-item-info">
                            <div class="app-notif-item-title">${escapeHtml(d.filename)}</div>
                            ${progressHtml}
                            <div class="app-notif-item-body">${escapeHtml(bodyText)}</div>
                            <div class="app-notif-item-time">${formatDate(d.startTime)}</div>
                        </div>
                    </div>
                </div>
            `
        }).join('')

        // Если файл-картинка удалили/переместили с диска после загрузки,
        // file:// не резолвится — откатываемся на обычную иконку документа
        // вместо сломанной иконки браузера.
        list.querySelectorAll('img.downloads-thumb[data-image-thumb]').forEach(img => {
            img.addEventListener('error', () => {
                const fallback = document.createElement('div')
                fallback.className = 'downloads-thumb downloads-thumb-generic'
                fallback.innerHTML = GENERIC_FILE_ICON
                img.replaceWith(fallback)
            }, { once: true })
        })

        // Перетаскивание файла из этой панели прямо в мессенджер — убрано в
        // v1.9.5. Пробовали дважды (startDrag() из main-процесса, затем
        // 'DownloadURL' в dataTransfer): первое документированно не работает
        // для intra-app-дропа на Windows (Electron issue #7118), второе
        // либо не долетает до <webview> вовсе, либо (для картинок между
        // мессенджерами) триггерит фолбэк открытия нового окна — тоже
        // известная проблема самого Electron с drop-событиями внутри
        // <webview>. «Открыть файл» / «Показать в папке» остаются рабочим
        // способом добраться до файла.
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
