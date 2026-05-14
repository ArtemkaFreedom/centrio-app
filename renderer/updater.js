function getToastContainer() {
    let container = document.getElementById('updateToastContainer')

    if (!container) {
        container = document.createElement('div')
        container.id = 'updateToastContainer'
        container.className = 'update-toast-container'
        document.body.appendChild(container)
    }

    return container
}

function removeExistingToast() {
    const t = document.getElementById('updateToast')
    if (!t) return
    t.classList.remove('show')
    setTimeout(() => { if (t.parentNode) t.remove() }, 360)
}

function showUpdateBanner(message, type = 'info', button = null) {
    removeExistingToast()

    const container = getToastContainer()
    const toast = document.createElement('div')
    toast.id = 'updateToast'
    toast.className = `update-toast update-toast-${type}`

    /* ── Header row: message + close button ─── */
    const header = document.createElement('div')
    header.className = 'update-toast-header'

    const titleEl = document.createElement('div')
    titleEl.className = 'update-toast-title'
    titleEl.textContent = message

    const closeBtn = document.createElement('button')
    closeBtn.className = 'update-toast-close'
    closeBtn.type = 'button'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('show')
        setTimeout(() => { if (toast.parentNode) toast.remove() }, 360)
    })

    header.appendChild(titleEl)
    header.appendChild(closeBtn)
    toast.appendChild(header)

    /* ── Action button (e.g. "Install") ─── */
    if (button) {
        const actions = document.createElement('div')
        actions.className = 'update-toast-actions'

        const btn = document.createElement('button')
        btn.className = 'update-toast-btn-primary'
        btn.textContent = button.text
        btn.addEventListener('click', button.action)

        actions.appendChild(btn)
        toast.appendChild(actions)
    }

    container.appendChild(toast)

    /* Double-rAF ensures element is in DOM before transition fires */
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'))
    })

    /* Auto-dismiss toasts without action button after 5 s */
    if (!button) {
        setTimeout(() => {
            toast.classList.remove('show')
            setTimeout(() => { if (toast.parentNode) toast.remove() }, 360)
        }, 5000)
    }
}

function bindUpdater({ ipcRenderer, invokeIpc, showUpdateBanner, tGet }) {
    ipcRenderer.on('update-status', (data = {}) => {
        if (!data || typeof data !== 'object') {
            console.warn('[updater] Invalid update-status payload:', data)
            return
        }

        const {
            status = 'unknown',
            version = '',
            percent = 0,
            error = null,
            label = ''
        } = data

        if (status === 'checking') {
            return
        }

        if (status === 'available') {
            showUpdateBanner(
                `🔔 ${label || tGet('updater.available')} ${version}`,
                'info'
            )
            return
        }

        if (status === 'downloading') {
            showUpdateBanner(
                `⬇ ${label || tGet('updater.downloading')}... ${percent}%`,
                'info'
            )
            return
        }

        if (status === 'downloaded') {
            showUpdateBanner(
                `✓ ${label || tGet('updater.downloaded')} ${version}`,
                'success',
                {
                    text: tGet('updater.installRestart'),
                    action: () => invokeIpc('install-update')
                }
            )
            return
        }

        if (status === 'not-available') {
            showUpdateBanner(
                `✓ ${label || tGet('updater.notAvailable')}`,
                'success'
            )
            return
        }

        if (status === 'error') {
            console.warn('[updater] Update error:', error)
            showUpdateBanner(
                `⚠ ${label || tGet('updater.error')}`,
                'error'
            )
        }
    })
}

module.exports = {
    bindUpdater,
    showUpdateBanner
}
