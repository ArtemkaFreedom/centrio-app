function createLockApi({
    state,
    store,
    tGet,
    ipcRenderer,
    hashPassword,
    pinInputNew,
    pinInputConfirm,
    pinDisableInput
}) {
    function isPasswordEnabled() {
        const sec = store.get('security', {})
        return sec.enabled === true && !!sec.hash
    }

    function updateLockBtn() {
        const btn = document.getElementById('lockBtn')
        if (!btn) return
        btn.style.display = isPasswordEnabled() ? 'flex' : 'none'
    }

    function checkLockOnStart() {
        if (!isPasswordEnabled()) return
        showLockScreen()
    }

    function updateLockDots(value) {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`lockDot${i}`)
            if (!dot) continue
            dot.classList.toggle('filled', i < value.length)
            dot.classList.remove('error')
        }
    }

    function showLockDotsError() {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`lockDot${i}`)
            if (!dot) continue
            dot.classList.remove('filled')
            dot.classList.add('error')
        }

        setTimeout(() => {
            for (let i = 0; i < 4; i++) document.getElementById(`lockDot${i}`)?.classList.remove('error')
        }, 400)
    }

    function showLockScreen() {
        const lockScreen = document.getElementById('lockScreen')
        const lockInput = document.getElementById('lockInput')
        if (!lockScreen || !lockInput) return

        document.body.classList.add('startup-locked')
        lockScreen.style.display = 'flex'
        lockInput.value = ''
        updateLockDots('')
        document.getElementById('lockError').style.display = 'none'
        setTimeout(() => lockInput.focus(), 150)
    }

    function hideLockScreen() {
        const lockScreen = document.getElementById('lockScreen')
        if (lockScreen) lockScreen.style.display = 'none'
        document.body.classList.remove('startup-locked')
    }

    function tryUnlock() {
        const input = document.getElementById('lockInput')
        if (!input) return

        const password = input.value
        if (password.length !== 4) return

        const sec = store.get('security', {})
        const hash = hashPassword(password)

        if (hash === sec.hash) {
            hideLockScreen()
            input.value = ''
            updateLockDots('')
        } else {
            showLockDotsError()
            const errorEl = document.getElementById('lockError')
            if (errorEl) errorEl.style.display = 'block'
            input.value = ''
            setTimeout(() => {
                const err = document.getElementById('lockError')
                if (err) err.style.display = 'none'
            }, 2000)
        }
    }

    function updateSetPinDots(value, prefix) {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`${prefix}${i}`)
            if (!dot) continue
            dot.classList.remove('filled', 'error', 'cursor')
            if (i < value.length) dot.classList.add('filled')
        }

        const isNew = prefix === 'setPinDot' && state.pinActive === 'new'
        const isConfirm = prefix === 'setConfirmDot' && state.pinActive === 'confirm'
        if ((isNew || isConfirm) && value.length < 4) {
            document.getElementById(`${prefix}${value.length}`)?.classList.add('cursor')
        }
    }

    function setPinDotsError(prefix) {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`${prefix}${i}`)
            if (!dot) continue
            dot.classList.remove('filled', 'cursor')
            dot.classList.add('error')
        }

        setTimeout(() => {
            for (let i = 0; i < 4; i++) document.getElementById(`${prefix}${i}`)?.classList.remove('error')
        }, 600)
    }

    function setActivePinBlock(which) {
        state.pinActive = which
        const newBlock = document.getElementById('setPinDotsNew')
        const confirmBlock = document.getElementById('setPinDotsConfirm')

        if (newBlock) newBlock.classList.toggle('active', which === 'new')
        if (confirmBlock) confirmBlock.classList.toggle('active', which === 'confirm')

        updateSetPinDots(state.pinNewVal, 'setPinDot')
        updateSetPinDots(state.pinConfirmVal, 'setConfirmDot')

        setTimeout(() => {
            if (which === 'new') pinInputNew.focus()
            if (which === 'confirm') pinInputConfirm.focus()
        }, 50)
    }

    function resetPinSetup() {
        state.pinNewVal = ''
        state.pinConfirmVal = ''
        state.pinActive = null
        pinInputNew.value = ''
        pinInputConfirm.value = ''

        updateSetPinDots('', 'setPinDot')
        updateSetPinDots('', 'setConfirmDot')

        document.getElementById('setPinDotsNew')?.classList.remove('active')
        document.getElementById('setPinDotsConfirm')?.classList.remove('active')

        const status = document.getElementById('passwordStatus')
        if (status) {
            status.textContent = ''
            status.className = 'password-status'
        }
    }

    function savePinClick() {
        const status = document.getElementById('passwordStatus')

        if (state.pinNewVal.length !== 4) {
            if (status) {
                status.textContent = tGet('lock.pinShort')
                status.className = 'password-status error'
            }
            setPinDotsError('setPinDot')
            setActivePinBlock('new')
            return
        }

        if (state.pinConfirmVal.length !== 4) {
            if (status) {
                status.textContent = tGet('lock.pinShort')
                status.className = 'password-status error'
            }
            setPinDotsError('setConfirmDot')
            setActivePinBlock('confirm')
            return
        }

        if (state.pinNewVal !== state.pinConfirmVal) {
            if (status) {
                status.textContent = tGet('settings.passwordMismatch')
                status.className = 'password-status error'
            }
            setPinDotsError('setConfirmDot')
            state.pinConfirmVal = ''
            pinInputConfirm.value = ''
            updateSetPinDots('', 'setConfirmDot')
            setActivePinBlock('confirm')
            return
        }

        const hash = hashPassword(state.pinNewVal)
        store.set('security', {
            enabled: true,
            hash,
            lockOnHide: document.getElementById('settingLockOnHide').checked
        })

        resetPinSetup()

        if (status) {
            status.textContent = tGet('lock.pinSaved')
            status.className = 'password-status success'
        }

        updateLockBtn()
        setTimeout(() => {
            const st = document.getElementById('passwordStatus')
            if (st) {
                st.textContent = ''
                st.className = 'password-status'
            }
        }, 3000)
    }

    function handlePinInput(inputEl, which) {
        const raw = inputEl.value.replace(/[^0-9]/g, '').slice(0, 4)
        inputEl.value = raw

        const status = document.getElementById('passwordStatus')

        if (which === 'new') {
            state.pinNewVal = raw
            updateSetPinDots(state.pinNewVal, 'setPinDot')
            if (status) status.textContent = ''
            if (state.pinNewVal.length === 4) setTimeout(() => setActivePinBlock('confirm'), 80)
        } else {
            state.pinConfirmVal = raw
            updateSetPinDots(state.pinConfirmVal, 'setConfirmDot')
            if (status) status.textContent = ''
            if (state.pinConfirmVal.length === 4) setTimeout(() => savePinClick(), 150)
        }
    }

    function updateDisableDots(value) {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`disableDot${i}`)
            if (!dot) continue
            dot.classList.toggle('filled', i < value.length)
            dot.classList.remove('error')
        }
    }

    function showDisableDotsError() {
        state.disableVal = ''
        updateDisableDots('')

        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`disableDot${i}`)
            if (!dot) continue
            dot.classList.remove('filled')
            dot.classList.add('error')
        }

        const err = document.getElementById('pinDisableError')
        if (err) err.style.display = 'block'

        setTimeout(() => {
            for (let i = 0; i < 4; i++) document.getElementById(`disableDot${i}`)?.classList.remove('error')
            const errorEl = document.getElementById('pinDisableError')
            if (errorEl) errorEl.style.display = 'none'
        }, 1500)
    }

    function openPinDisableModal() {
        state.disableVal = ''
        updateDisableDots('')
        const err = document.getElementById('pinDisableError')
        if (err) err.style.display = 'none'
        const modal = document.getElementById('pinDisableModal')
        if (modal) modal.style.display = 'flex'
        setTimeout(() => pinDisableInput.focus(), 100)
    }

    function closePinDisableModal(restoreCheck = true) {
        const modal = document.getElementById('pinDisableModal')
        if (modal) modal.style.display = 'none'
        state.disableVal = ''
        if (restoreCheck) {
            const checkbox = document.getElementById('settingPasswordEnable')
            if (checkbox) checkbox.checked = true
        }
    }

    function tryDisablePin() {
        if (state.disableVal.length !== 4) return

        const sec = store.get('security', {})
        const hash = hashPassword(state.disableVal)

        if (hash === sec.hash) {
            store.set('security', { enabled: false, hash: null, lockOnHide: false })
            const fields = document.getElementById('passwordFields')
            if (fields) fields.style.display = 'none'
            resetPinSetup()
            updateLockBtn()
            closePinDisableModal(false)
        } else {
            showDisableDotsError()
        }
    }

    function showForgotPinConfirm() {
        const lockBox = document.querySelector('.lock-box')
        if (!lockBox) return

        const originalHTML = lockBox.innerHTML
        lockBox.innerHTML = `
            <div class="lock-logo-circle" style="background:rgba(239,68,68,0.15);border-color:var(--danger);color:var(--danger);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
            </div>
            <h2 class="lock-title" style="color:var(--danger);">${tGet('lock.resetTitle')}</h2>
            <p class="lock-sub" style="text-align:center;max-width:260px;line-height:1.6;">${tGet('lock.resetDesc')}</p>
            <div style="display:flex;flex-direction:column;gap:10px;width:100%;margin-top:8px;">
                <button id="confirmResetBtn" class="lock-key lock-key-enter"
                        style="width:100%;height:44px;border-radius:10px;font-size:13px;background:var(--danger);gap:8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    ${tGet('lock.resetConfirmBtn')}
                </button>
                <button id="cancelResetBtn" class="pin-disable-cancel" style="margin-top:0;">
                    ${tGet('lock.resetCancelBtn')}
                </button>
            </div>
        `

        document.getElementById('confirmResetBtn')?.addEventListener('click', () => {
            store.clear()
            ipcRenderer.send('quit-app', true)
        })

        document.getElementById('cancelResetBtn')?.addEventListener('click', () => {
            lockBox.innerHTML = originalHTML
            rebindLockScreen()
        })
    }

    function rebindLockScreen() {
        document.querySelectorAll('.lock-key[data-digit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById('lockInput')
                if (!input) return
                if (input.value.length < 4) {
                    input.value += btn.dataset.digit
                    updateLockDots(input.value)
                    if (input.value.length === 4) setTimeout(() => tryUnlock(), 120)
                }
            })
        })

        document.getElementById('lockClearBtn')?.addEventListener('click', () => {
            const input = document.getElementById('lockInput')
            if (!input) return
            input.value = input.value.slice(0, -1)
            updateLockDots(input.value)
            const err = document.getElementById('lockError')
            if (err) err.style.display = 'none'
        })

        document.getElementById('lockSubmitBtn')?.addEventListener('click', () => tryUnlock())

        document.getElementById('lockInput')?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
            updateLockDots(e.target.value)
            if (e.target.value.length === 4) setTimeout(() => tryUnlock(), 120)
        })

        document.getElementById('lockInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') tryUnlock()
            if (e.key === 'Backspace') {
                setTimeout(() => {
                    const input = document.getElementById('lockInput')
                    if (input) updateLockDots(input.value)
                }, 0)
            }
        })

        document.getElementById('forgotPinBtn')?.addEventListener('click', () => showForgotPinConfirm())

        const input = document.getElementById('lockInput')
        if (input) {
            input.value = ''
            updateLockDots('')
        }

        const err = document.getElementById('lockError')
        if (err) err.style.display = 'none'
        setTimeout(() => input?.focus(), 100)
    }

    return {
        isPasswordEnabled,
        updateLockBtn,
        checkLockOnStart,
        updateLockDots,
        showLockDotsError,
        showLockScreen,
        hideLockScreen,
        tryUnlock,
        updateSetPinDots,
        setPinDotsError,
        setActivePinBlock,
        resetPinSetup,
        savePinClick,
        handlePinInput,
        updateDisableDots,
        showDisableDotsError,
        openPinDisableModal,
        closePinDisableModal,
        tryDisablePin,
        showForgotPinConfirm,
        rebindLockScreen
    }
}

module.exports = {
    createLockApi
}