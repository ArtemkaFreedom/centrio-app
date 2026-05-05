function bindSettingsUi({
    store,
    ipcRenderer,
    tGet,
    openSettings,
    collectSettings,
    applySettings,
    resetPinSetup,
    setActivePinBlock,
    openPinDisableModal,
    updateLockBtn,
    requirePro,
    openExtensionsSection
}) {
    const settingsBtn = document.getElementById('settingsBtn')
    const closeSettingsBtn = document.getElementById('closeSettingsBtn')
    const settingsModal = document.getElementById('settingsModal')
    const applySettingsBtn = document.getElementById('applySettingsBtn')
    const resetAllBtn = document.getElementById('resetAllBtn')
    const settingPasswordEnable = document.getElementById('settingPasswordEnable')

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => openSettings())
    }

    if (closeSettingsBtn && settingsModal) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('show')
        })
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('show')
            }
        })
    }

    document.querySelectorAll('.settings-nav-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.settings-nav-item').forEach((i) => i.classList.remove('active'))
            document.querySelectorAll('.settings-section').forEach((s) => s.classList.remove('active'))

            item.classList.add('active')

            const sectionId = `section-${item.dataset.section}`
            const section = document.getElementById(sectionId)
            if (section) section.classList.add('active')

            if (item.dataset.section === 'extensions' && typeof openExtensionsSection === 'function') {
                openExtensionsSection()
            }
        })
    })

    if (applySettingsBtn) {
        applySettingsBtn.addEventListener('click', async () => {
            const previousSettings = store.get('settings', {}) || {}
            const settings = collectSettings()
            const oldLang = previousSettings.language || 'ru'

            await store.setAsync?.('settings', settings) || store.set('settings', settings)
            applySettings(settings)

            const autoLaunch = document.getElementById('settingAutoLaunch')
            ipcRenderer.send('set-auto-launch', !!autoLaunch?.checked)

            ipcRenderer.send('set-download-dir', settings.downloadDir || '')
            ipcRenderer.send('set-ask-download', settings.askDownload ?? true)

            if (settings.language !== oldLang) {
                // Перезагружаем рендерер — быстрее и надёжнее чем app.relaunch(),
                // настройки уже сохранены в store, initI18n подхватит новый язык.
                window.location.reload()
                return
            }

            const status = document.getElementById('settingsStatus')
            if (status) {
                status.textContent = tGet('settings.applied')
                status.classList.add('success')

                setTimeout(() => {
                    status.textContent = ''
                    status.classList.remove('success')
                }, 3000)
            }
        })
    }

    document.querySelectorAll('.theme-item').forEach((item) => {
        item.addEventListener('click', () => {
            const theme = item.dataset.theme
            if (theme !== 'dark') {
                if (requirePro && !requirePro('themes')) return
            }
            document.querySelectorAll('.theme-item').forEach((i) => i.classList.remove('active'))
            item.classList.add('active')
        })
    })

    document.querySelectorAll('.accent-item').forEach((item) => {
        item.addEventListener('click', () => {
            if (item.id === 'accentCustomItem') {
                if (requirePro && !requirePro('accent')) return
                openColorPickerModal()
                return
            }
            const color = item.dataset.color
            if (color !== '#7b68ee') {
                if (requirePro && !requirePro('accent')) return
            }
            document.querySelectorAll('.accent-item').forEach((i) => i.classList.remove('active'))
            item.classList.add('active')
        })
    })

    // ── Custom color picker modal ─────────────────────────────────────────────
    const COLOR_PRESETS = [
        '#7b68ee','#e17055','#00b894','#fd79a8','#fdcb6e','#a29bfe',
        '#0984e3','#e84393','#00cec9','#d63031','#6c5ce7','#55efc4',
        '#f39c12','#2d3436','#74b9ff','#ff7675',
    ]

    function openColorPickerModal() {
        const modal = document.getElementById('colorPickerModal')
        if (!modal) return
        const customItem = document.getElementById('accentCustomItem')
        const currentColor = customItem?.dataset.color || '#7b68ee'

        // Build presets
        const presetsEl = document.getElementById('colorPickerPresets')
        if (presetsEl) {
            presetsEl.innerHTML = ''
            COLOR_PRESETS.forEach(c => {
                const dot = document.createElement('div')
                dot.className = 'color-picker-preset' + (c === currentColor ? ' active' : '')
                dot.style.background = c
                dot.dataset.color = c
                dot.addEventListener('click', () => {
                    presetsEl.querySelectorAll('.color-picker-preset').forEach(d => d.classList.remove('active'))
                    dot.classList.add('active')
                    setPickerColor(c)
                })
                presetsEl.appendChild(dot)
            })
        }

        setPickerColor(currentColor)
        modal.style.display = 'flex'
    }

    function setPickerColor(hex) {
        const clean = hex.replace('#', '').slice(0, 6)
        const preview = document.getElementById('colorPickerPreview')
        const hexInput = document.getElementById('colorPickerHex')
        if (preview) preview.style.background = '#' + clean
        if (hexInput) hexInput.value = clean
    }

    function applyPickerColor(hex) {
        const color = '#' + hex.replace('#', '').slice(0, 6)
        const customItem = document.getElementById('accentCustomItem')
        document.querySelectorAll('.accent-item').forEach(i => i.classList.remove('active'))
        if (customItem) {
            customItem.classList.add('active', 'has-color')
            customItem.dataset.color = color
            customItem.style.setProperty('--accent-custom-color', color)
        }
    }

    const colorPickerHex = document.getElementById('colorPickerHex')
    if (colorPickerHex) {
        colorPickerHex.addEventListener('input', (e) => {
            const v = e.target.value.replace(/[^0-9a-fA-F]/g, '')
            e.target.value = v
            if (v.length === 6) {
                const preview = document.getElementById('colorPickerPreview')
                if (preview) preview.style.background = '#' + v
            }
        })
    }

    const colorPickerApply = document.getElementById('colorPickerApply')
    if (colorPickerApply) {
        colorPickerApply.addEventListener('click', () => {
            const hex = document.getElementById('colorPickerHex')?.value || ''
            if (hex.length >= 3) applyPickerColor(hex)
            document.getElementById('colorPickerModal').style.display = 'none'
        })
    }

    const colorPickerCancel = document.getElementById('colorPickerCancel')
    const colorPickerClose = document.getElementById('colorPickerClose')
    const closePicker = () => { document.getElementById('colorPickerModal').style.display = 'none' }
    if (colorPickerCancel) colorPickerCancel.addEventListener('click', closePicker)
    if (colorPickerClose) colorPickerClose.addEventListener('click', closePicker)

    const colorPickerBackdrop = document.querySelector('.color-picker-backdrop')
    if (colorPickerBackdrop) colorPickerBackdrop.addEventListener('click', closePicker)

    document.querySelectorAll('.density-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.density-item').forEach((i) => i.classList.remove('active'))
            item.classList.add('active')
        })
    })

    document.querySelectorAll('.position-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.position-item').forEach((i) => i.classList.remove('active'))
            item.classList.add('active')
        })
    })

    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn')
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', async () => {
            checkUpdatesBtn.disabled = true
            checkUpdatesBtn.textContent = tGet('settings.checkUpdatesChecking') || 'Проверяем...'
            try {
                await ipcRenderer.invoke('check-for-updates')
            } catch (e) {
                console.error('[settings] checkForUpdates error:', e)
            } finally {
                setTimeout(() => {
                    checkUpdatesBtn.disabled = false
                    checkUpdatesBtn.textContent = tGet('settings.checkUpdatesBtn') || 'Проверить обновления'
                }, 3000)
            }
        })
    }

    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', async () => {
            if (!confirm(tGet('settings.resetConfirm'))) return

            const keysToDelete = [
                'menuCollapsed',
                'appZoomLevel',
                'tabZoomLevel',
                'settings',
                'messengers',
                'folders',
                'mutedMessengers',
                'globalMuteAll',
                'security',
                'pinEnabled',
                'pinHash',
                'lockOnStartup'
            ]

            for (const key of keysToDelete) {
                try {
                    await store.delete(key)
                } catch (error) {
                    console.error(`Failed to delete key "${key}"`, error)
                }
            }

            ipcRenderer.send('quit-app', true)
        })
    }

    if (settingPasswordEnable) {
        settingPasswordEnable.addEventListener('change', (e) => {
            const fields = document.getElementById('passwordFields')
            const enabled = e.target.checked

            if (!enabled) {
                const sec = store.get('security', {}) || {}
                if (sec.hash) {
                    openPinDisableModal()
                    return
                }

                store.set('security', {
                    enabled: false,
                    hash: null,
                    lockOnHide: false
                })

                if (fields) fields.style.display = 'none'
                resetPinSetup()
                updateLockBtn()
                return
            }

            if (fields) fields.style.display = 'block'
            resetPinSetup()
            setTimeout(() => setActivePinBlock('new'), 150)
        })
    }
}

module.exports = {
    bindSettingsUi
}