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
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
            </svg>`,
            color: '#ef4444',
            bg: 'rgba(239,68,68,.13)',
            border: 'rgba(239,68,68,.28)',
            titleKey: 'extensions.adblock.title',
            descKey: 'extensions.adblock.desc'
        },
        {
            id: 'translate',
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 8l6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
                <path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
            </svg>`,
            color: '#3b82f6',
            bg: 'rgba(59,130,246,.13)',
            border: 'rgba(59,130,246,.28)',
            titleKey: 'extensions.translate.title',
            descKey: 'extensions.translate.desc'
        },
        {
            id: 'grammarly',
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>`,
            color: '#10b981',
            bg: 'rgba(16,185,129,.13)',
            border: 'rgba(16,185,129,.28)',
            titleKey: 'extensions.grammarly.title',
            descKey: 'extensions.grammarly.desc'
        },
        {
            id: 'screenshot',
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
            </svg>`,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,.13)',
            border: 'rgba(245,158,11,.28)',
            titleKey: 'extensions.screenshot.title',
            descKey: 'extensions.screenshot.desc'
        },
        {
            id: 'darkmode',
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>`,
            color: '#8b5cf6',
            bg: 'rgba(139,92,246,.13)',
            border: 'rgba(139,92,246,.28)',
            titleKey: 'extensions.darkmode.title',
            descKey: 'extensions.darkmode.desc'
        }
    ]

    function isPro() {
        // requirePro returns true if PRO, false if not
        // We need to check without showing modal — check via cloudStore
        // requirePro is a function that shows modal if not PRO
        // We'll use a try-call approach: check plan from DOM or pass isPro separately
        // For now, we pass it through requirePro by checking return without triggering
        return false // will be overridden by proCheck below
    }

    function getExtensionState() {
        return store.get('extensionsState', {}) || {}
    }

    function getUserIsPro() {
        // Check plan stored in cloud state without triggering modal
        try {
            const cloudUser = store.get('cloud.user', null)
            const plan = (cloudUser?.plan || 'FREE').toUpperCase()
            return plan !== 'FREE'
        } catch {
            return false
        }
    }

    function renderExtensionsCatalog() {
        const container = document.getElementById('extensionsCatalog')
        if (!container) return

        container.innerHTML = ''
        const state = getExtensionState()
        const userIsPro = getUserIsPro()

        NATIVE_EXTENSIONS.forEach(ext => {
            const card = document.createElement('div')
            card.className = 'ext-card'

            // OFF by default — only on if explicitly enabled
            const isEnabled = state[ext.id] === true

            const lockBadge = !userIsPro
                ? `<div class="ext-pro-lock" title="Pro">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Pro
                </div>`
                : ''

            card.innerHTML = `
                <div class="ext-card-icon" style="background:${ext.bg};border-color:${ext.border};color:${ext.color}">
                    ${ext.icon}
                </div>
                <div class="ext-card-info">
                    <div class="ext-card-name">${tGet(ext.titleKey)}</div>
                    <div class="ext-card-desc">${tGet(ext.descKey)}</div>
                </div>
                <div class="ext-card-actions">
                    ${lockBadge}
                    <label class="toggle ${!userIsPro ? 'toggle-locked' : ''}">
                        <input type="checkbox" id="ext-toggle-${ext.id}" ${isEnabled ? 'checked' : ''} ${!userIsPro ? 'disabled' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `

            const toggle = card.querySelector('input')
            toggle.addEventListener('change', (e) => {
                if (!userIsPro) {
                    e.target.checked = false
                    if (requirePro) requirePro('extensions')
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
