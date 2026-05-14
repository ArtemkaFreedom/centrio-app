'use strict'

function createExtensionsUiApi({
    store,
    tGet,
    requirePro,
    onExtensionToggle
}) {
    const NATIVE_EXTENSIONS = [
        {
            id: 'adblock',
            icon: '🛡️',
            titleKey: 'extensions.adblock.title',
            descKey: 'extensions.adblock.desc'
        },
        {
            id: 'translate',
            icon: '🌐',
            titleKey: 'extensions.translate.title',
            descKey: 'extensions.translate.desc'
        },
        {
            id: 'grammarly',
            icon: '✍️',
            titleKey: 'extensions.grammarly.title',
            descKey: 'extensions.grammarly.desc'
        },
        {
            id: 'screenshot',
            icon: '📸',
            titleKey: 'extensions.screenshot.title',
            descKey: 'extensions.screenshot.desc'
        },
        {
            id: 'darkmode',
            icon: '🌙',
            titleKey: 'extensions.darkmode.title',
            descKey: 'extensions.darkmode.desc'
        }
    ]

    function getExtensionState() {
        return store.get('extensionsState', {}) || {}
    }

    function renderExtensionsCatalog() {
        const container = document.getElementById('extensionsCatalog')
        if (!container) return

        container.innerHTML = ''
        const state = getExtensionState()

        NATIVE_EXTENSIONS.forEach(ext => {
            const card = document.createElement('div')
            card.className = 'ext-card'

            const isEnabled = state[ext.id] !== false // Enabled by default

            card.innerHTML = `
                <div class="ext-card-icon">${ext.icon}</div>
                <div class="ext-card-info">
                    <div class="ext-card-title">${tGet(ext.titleKey)}</div>
                    <div class="ext-card-desc">${tGet(ext.descKey)}</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" id="ext-toggle-${ext.id}" ${isEnabled ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            `

            const toggle = card.querySelector('input')
            toggle.addEventListener('change', (e) => {
                if (requirePro && !requirePro('extensions')) {
                    e.target.checked = !e.target.checked
                    return
                }

                const newState = getExtensionState()
                newState[ext.id] = e.target.checked
                store.set('extensionsState', newState)

                if (typeof onExtensionToggle === 'function') {
                    onExtensionToggle(ext.id, e.target.checked)
                }
            })

            container.appendChild(card)
        })
    }

    function openExtensionsSection() {
        renderExtensionsCatalog()
    }

    return {
        renderExtensionsCatalog,
        openExtensionsSection
    }
}

module.exports = {
    createExtensionsUiApi
}
