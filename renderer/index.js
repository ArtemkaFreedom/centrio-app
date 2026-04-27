console.log('[renderer] bundle entry loaded')

window.addEventListener('DOMContentLoaded', async () => {
    console.log('[renderer] DOM ready')

    if (!window.electronAPI) {
        console.warn('[renderer] window.electronAPI is not available')
    } else {
        console.log('[renderer] window.electronAPI is available')
    }

    try {
        require('../renderer.js')
        console.log('[renderer] legacy renderer.js loaded')
    } catch (error) {
        console.error('[renderer] failed to load legacy renderer.js')
        console.error(error)
    }
})