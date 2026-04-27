// Привязка уведомлений приложения (от администратора / changelog)
function bindAppNotifUi({
    cloudStore,
    invokeIpc,
    authorizedInvoke,
    tGet,
    state,
    toggleMuteAll
}) {
    const btn          = document.getElementById('appNotifBtn')
    const panel        = document.getElementById('appNotifPanel')
    const badge        = document.getElementById('appNotifBadge')
    const list         = document.getElementById('appNotifList')
    const markAllBtn   = document.getElementById('appNotifMarkAllRead')
    const deleteAllBtn = document.getElementById('appNotifDeleteAll')
    const muteToggle   = document.getElementById('appNotifMuteToggle')

    if (!btn || !panel) return

    let notifications = []
    let panelOpen = false

    // ── Dismiss (навсегда скрыть) ──────────────────────────────────────────────
    const DISMISSED_KEY = 'centrio-dismissed-notifs'

    function getDismissed() {
        try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')) }
        catch { return new Set() }
    }

    function dismiss(id) {
        const set = getDismissed()
        set.add(id)
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
        notifications = notifications.filter(n => n.id !== id)
        updateBadge()
        renderPanel()
    }

    function getVisible() {
        const dismissed = getDismissed()
        return notifications.filter(n => !dismissed.has(n.id))
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    function getToken() {
        return cloudStore?.isLoggedIn?.() ? cloudStore.getToken?.() : null
    }

    function formatDate(dateStr) {
        try {
            const d = new Date(dateStr)
            const now = new Date()
            const diffMs = now - d
            const diffMins = Math.floor(diffMs / 60000)
            if (diffMins < 1) return 'только что'
            if (diffMins < 60) return `${diffMins} мин назад`
            const diffH = Math.floor(diffMins / 60)
            if (diffH < 24) return `${diffH} ч назад`
            return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
        } catch { return '' }
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    function renderPanel() {
        if (!list) return

        const visible = getVisible()

        if (!visible.length) {
            list.innerHTML = `<div class="app-notif-empty">${tGet('notifications.noNotifs')}</div>`
            return
        }

        list.innerHTML = visible.map(n => {
            const imgHtml = n.imageUrl
                ? `<img class="app-notif-item-img" src="${escapeHtml(n.imageUrl)}" alt="" loading="lazy">`
                : ''

            const actionHtml = n.actionLabel && n.actionUrl
                ? `<button class="app-notif-action-btn" data-open-url="${escapeHtml(n.actionUrl)}">${escapeHtml(n.actionLabel)}</button>`
                : ''

            return `
                <div class="app-notif-item ${n.isRead ? '' : 'unread'}" data-id="${escapeHtml(n.id)}">
                    <button class="app-notif-dismiss" data-dismiss-id="${escapeHtml(n.id)}" title="Скрыть навсегда">✕</button>
                    ${imgHtml}
                    <div class="app-notif-item-title">${escapeHtml(n.title)}</div>
                    <div class="app-notif-item-body">${escapeHtml(n.body)}</div>
                    ${actionHtml}
                    <div class="app-notif-item-time">${formatDate(n.createdAt)}</div>
                </div>
            `
        }).join('')

        // Attach dismiss listeners
        list.querySelectorAll('.app-notif-dismiss').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation()
                dismiss(btn.dataset.dismissId)
            })
        })

        // Attach action button listeners (open external URL)
        list.querySelectorAll('.app-notif-action-btn[data-open-url]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation()
                const url = btn.dataset.openUrl
                if (!url) return
                // В Electron — через electronAPI, иначе window.open
                if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal(url)
                } else {
                    window.open(url, '_blank', 'noopener')
                }
            })
        })
    }

    function updateBadge() {
        const dismissed = getDismissed()
        const unread = notifications.filter(n => !n.isRead && !dismissed.has(n.id)).length
        if (badge) {
            if (unread > 0) {
                badge.textContent = unread > 99 ? '99+' : String(unread)
                badge.style.display = 'flex'
            } else {
                badge.style.display = 'none'
            }
        }
    }

    function syncMuteToggle() {
        if (!muteToggle) return
        const muted = state?.globalMuteAll ?? false
        const iconNormal = muteToggle.querySelector('.mute-icon-normal')
        const iconMuted  = muteToggle.querySelector('.mute-icon-muted')
        if (muted) {
            muteToggle.classList.add('muted')
            muteToggle.title = 'Включить уведомления'
            if (iconNormal) iconNormal.style.display = 'none'
            if (iconMuted)  iconMuted.style.display  = 'block'
        } else {
            muteToggle.classList.remove('muted')
            muteToggle.title = 'Отключить уведомления'
            if (iconNormal) iconNormal.style.display = 'block'
            if (iconMuted)  iconMuted.style.display  = 'none'
        }
    }

    async function fetchNotifications() {
        if (!cloudStore?.isLoggedIn?.()) return

        try {
            const invoker = typeof authorizedInvoke === 'function' ? authorizedInvoke : null
            const token = getToken()
            const result = invoker
                ? await invoker('api-get-notifications')
                : token ? await invokeIpc('api-get-notifications', token) : null

            // Сервер возвращает { success, data:[] }, wrapApi оборачивает ещё раз
            const notifArray = Array.isArray(result?.data)
                ? result.data
                : Array.isArray(result?.data?.data)
                ? result.data.data
                : null

            if (result?.success && notifArray) {
                const prevIds = new Set(notifications.map(n => n.id))
                const dismissed = getDismissed()
                const newOnes = notifArray.filter(n => !prevIds.has(n.id) && !n.isRead && !dismissed.has(n.id))

                notifications = notifArray
                updateBadge()
                if (panelOpen) renderPanel()

                for (const n of newOnes) {
                    try {
                        new window.Notification(n.title || 'Centrio', {
                            body: n.body || '',
                            icon: '../assets/logo.png'
                        })
                    } catch {}
                }
            }
        } catch {}
    }

    function addMessengerNotification(title, body, messengerName) {
        const fakeEntry = {
            id: `local-${Date.now()}-${Math.random()}`,
            title: messengerName ? `${messengerName}: ${title}` : title,
            body: body || '',
            isRead: false,
            createdAt: new Date().toISOString(),
            imageUrl: null,
            actionLabel: null,
            actionUrl: null
        }
        notifications.unshift(fakeEntry)
        updateBadge()
        if (panelOpen) renderPanel()
    }

    function openPanel() {
        panelOpen = true
        syncMuteToggle()
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

    markAllBtn?.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!cloudStore?.isLoggedIn?.()) return

        try {
            if (typeof authorizedInvoke === 'function') {
                await authorizedInvoke('api-read-all-notifications')
            } else {
                const token = getToken()
                if (token) await invokeIpc('api-read-all-notifications', token)
            }
            notifications = notifications.map(n => ({ ...n, isRead: true }))
            updateBadge()
            renderPanel()
        } catch {}
    })

    deleteAllBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        // Добавляем все видимые уведомления в dismissed
        const dismissed = getDismissed()
        notifications.forEach(n => dismissed.add(n.id))
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
        updateBadge()
        renderPanel()
    })

    muteToggle?.addEventListener('click', (e) => {
        e.stopPropagation()
        if (typeof toggleMuteAll === 'function') {
            toggleMuteAll()
        }
        syncMuteToggle()
    })

    document.addEventListener('click', (e) => {
        if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) {
            closePanel()
        }
    })

    fetchNotifications()
    setInterval(fetchNotifications, 45 * 1000)

    window.addEventListener('focus', () => {
        fetchNotifications()
    })

    return { fetchNotifications, addMessengerNotification }
}

module.exports = { bindAppNotifUi }
