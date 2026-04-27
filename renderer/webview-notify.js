function createWebviewNotifyApi({
    state,
    store,
    tGet,
    ipcRenderer,
    invokeIpc,
    playNotifSound,
    isMessengerMuted,
    updateUnreadCount,
    addMessengerNotification
}) {
    async function sendPushNotificationFromSite(messenger, payload = {}) {
        const settings = store.get('settings', {})
        if (settings.notifications === false) return
        if (isMessengerMuted(messenger.id)) return

        const title = String(payload.title || messenger.name || tGet('notifications.messageTitle')).trim()
        const body = String(payload.body || tGet('notifications.newMessage')).trim()
        const tag = String(payload.tag || '')
        const icon = payload.icon || messenger.icon || ''

        const dedupeKey = `${messenger.id}::${title}::${body}::${tag}`
        const now = Date.now()
        const prevTime = state.siteNotificationState[dedupeKey] || 0
        if (now - prevTime < 5000) return
        state.siteNotificationState[dedupeKey] = now

        const isActiveTab = state.activeTabId === messenger.id

        let winState = { visible: true, focused: true, minimized: false }
        try {
            const result = await invokeIpc('get-window-visibility-state')
            if (result.success && result.data) winState = result.data
        } catch {}

        const appInForeground = winState.visible && !winState.minimized && winState.focused
        const shouldPlaySound = settings.notifSound !== false
        const shouldShowNotification = !appInForeground || !isActiveTab

        // ── Count notification regardless of whether we show OS popup ──
        invokeIpc('tracker:notif', 1).catch(() => {})

        // ── Добавляем в панель уведомлений как уведомление от мессенджера ──
        if (typeof addMessengerNotification === 'function') {
            addMessengerNotification(title, body, messenger.name)
        }

        if (shouldPlaySound) playNotifSound(messenger.id)
        if (!shouldShowNotification) return

        ipcRenderer.send('show-notification', {
            title: messenger.name || title,
            body: body || tGet('notifications.newMessage'),
            icon,
            messengerId: messenger.id,
            silent: true
        })
    }

    function watchWebview(webview, messenger) {
        if (state.webviewWatchBound.has(webview.id)) return
        state.webviewWatchBound.add(webview.id)

        webview.addEventListener('ipc-message', (e) => {
            if (e.channel === 'unread-count') {
                const rawCount = Number(e.args[0])
                const count = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : 0
                updateUnreadCount(messenger.id, count)
                return
            }

            if (e.channel === 'site-notification') {
                const payload = e.args[0] || {}
                sendPushNotificationFromSite(messenger, payload)
                return
            }

            if (e.channel === 'msg-sent') {
                invokeIpc('tracker:msg-sent').catch(() => {})
            }
        })
    }

    return {
        sendPushNotificationFromSite,
        watchWebview
    }
}

module.exports = {
    createWebviewNotifyApi
}