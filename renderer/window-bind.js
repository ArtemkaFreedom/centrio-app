function bindWindowUi({
    store,
    state,
    ipcRenderer,
    switchTab,
    showLockScreen,
    openSettings
}) {
    document.getElementById('minimizeBtn')?.addEventListener('click', () => {
        ipcRenderer.send('minimize-window')
    })

    document.getElementById('maximizeBtn')?.addEventListener('click', () => {
        ipcRenderer.send('maximize-window')
    })

    document.getElementById('closeBtn')?.addEventListener('click', () => {
        ipcRenderer.send('close-window')
    })

    ipcRenderer.on('app-hidden', () => {
        const sec = store.get('security', {})
        if (sec.enabled && sec.lockOnHide) showLockScreen()
    })

    ipcRenderer.on('switch-messenger-index', (index) => {
        if (state.activeMessengers[index]) switchTab(state.activeMessengers[index].id)
    })

    ipcRenderer.on('switch-messenger-next', () => {
        if (!state.activeMessengers.length) return
        const idx = state.activeMessengers.findIndex(m => m.id === state.activeTabId)
        if (idx === -1) return
        switchTab(state.activeMessengers[(idx + 1) % state.activeMessengers.length].id)
    })

    ipcRenderer.on('switch-messenger-prev', () => {
        if (!state.activeMessengers.length) return
        const idx = state.activeMessengers.findIndex(m => m.id === state.activeTabId)
        if (idx === -1) return
        switchTab(state.activeMessengers[(idx - 1 + state.activeMessengers.length) % state.activeMessengers.length].id)
    })

    ipcRenderer.on('reload-active', () => {
        if (!state.activeTabId) return
        document.getElementById(`webview-${state.activeTabId}`)?.reload()
    })

    ipcRenderer.on('open-settings', () => {
        if (typeof openSettings === 'function') openSettings()
    })

    ipcRenderer.on('notification-clicked-id', (event, messengerId) => {
        if (!messengerId) return
        switchTab(messengerId)
    })
}

module.exports = {
    bindWindowUi
}