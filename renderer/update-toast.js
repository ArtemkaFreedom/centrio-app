function createUpdateToastManager() {
    const container = document.getElementById('updateToastContainer')
    if (!container || !window.electronAPI) return

    let currentToast = null

    function removeCurrentToast() {
        if (!currentToast) return
        const t = currentToast
        t.classList.remove('show')
        setTimeout(() => { if (t.parentNode) t.remove() }, 360)
        currentToast = null
    }

    function buildButton(text, className, onClick) {
        const button = document.createElement('button')
        button.className = className
        button.textContent = text
        button.addEventListener('click', onClick)
        return button
    }

    function showToast(options) {
        removeCurrentToast()

        const toast = document.createElement('div')
        toast.className = 'update-toast'

        /* ── Header ───────────────────────────────────────────── */
        const header = document.createElement('div')
        header.className = 'update-toast-header'

        const title = document.createElement('div')
        title.className = 'update-toast-title'
        title.textContent = options.title || 'Обновление'

        const closeButton = document.createElement('button')
        closeButton.className = 'update-toast-close'
        closeButton.type = 'button'
        closeButton.textContent = '×'
        closeButton.addEventListener('click', removeCurrentToast)

        header.appendChild(title)
        header.appendChild(closeButton)
        toast.appendChild(header)

        /* ── Message ──────────────────────────────────────────── */
        if (options.message) {
            const message = document.createElement('div')
            message.className = 'update-toast-message'
            message.textContent = options.message
            toast.appendChild(message)
        }

        /* ── Progress bar ─────────────────────────────────────── */
        if (typeof options.percent === 'number') {
            const progressWrap = document.createElement('div')
            progressWrap.className = 'update-toast-progress-wrap'

            const progressBar = document.createElement('div')
            progressBar.className = 'update-toast-progress-bar'

            const progressFill = document.createElement('div')
            progressFill.className = 'update-toast-progress-fill'
            progressFill.style.width = `${Math.max(0, Math.min(100, options.percent))}%`

            const progressText = document.createElement('div')
            progressText.className = 'update-toast-progress-text'
            progressText.textContent = `${Math.max(0, Math.min(100, options.percent))}%`

            progressBar.appendChild(progressFill)
            progressWrap.appendChild(progressBar)
            progressWrap.appendChild(progressText)
            toast.appendChild(progressWrap)
        }

        /* ── Actions ──────────────────────────────────────────── */
        const actions = document.createElement('div')
        actions.className = 'update-toast-actions'

        if (options.primaryAction) {
            actions.appendChild(
                buildButton(
                    options.primaryAction.text,
                    'update-toast-btn-primary',
                    options.primaryAction.onClick
                )
            )
        }

        actions.appendChild(
            buildButton(
                'Закрыть',
                'update-toast-btn-secondary',
                removeCurrentToast
            )
        )

        toast.appendChild(actions)
        container.appendChild(toast)
        currentToast = toast

        /* Animate in on next frame */
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'))
        })
    }

    window.electronAPI.onUpdateStatus((payload) => {
        if (!payload || !payload.status) return

        if (payload.status === 'available') {
            showToast({
                title: '🔔 Новая версия доступна',
                message:
                    payload.message ||
                    `Доступна новая версия ${payload.version}. Обновление скачивается автоматически.`
            })
            return
        }

        if (payload.status === 'downloading') {
            showToast({
                title: '⬇ Скачивание обновления',
                message:
                    payload.message ||
                    `Скачивание: ${payload.percent || 0}%`,
                percent: Number(payload.percent || 0)
            })
            return
        }

        if (payload.status === 'downloaded') {
            showToast({
                title: '✓ Обновление готово',
                message:
                    payload.message ||
                    `Версия ${payload.version} скачана и готова к установке.`,
                primaryAction: {
                    text: 'Установить и перезапустить',
                    onClick: async () => {
                        try {
                            await window.electronAPI.installUpdate()
                        } catch (error) {
                            console.error('installUpdate failed:', error)
                        }
                    }
                }
            })
            return
        }

        if (payload.status === 'error') {
            showToast({
                title: '⚠ Ошибка обновления',
                message:
                    payload.message ||
                    payload.error ||
                    'Не удалось скачать обновление.'
            })
        }
    })
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUpdateToastManager)
} else {
    createUpdateToastManager()
}
