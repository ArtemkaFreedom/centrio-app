function bindMessengerSoundUi({
    state,
    saveData,
    hideAllMenus,
    previewMessengerSound,
    openMessengerSoundModal,
    getMessengerById
}) {
    document.getElementById('ctxSound')?.addEventListener('click', () => {
        if (!state.contextTargetId) return
        state.soundTargetId = state.contextTargetId
        openMessengerSoundModal(state.contextTargetId, getMessengerById)
        hideAllMenus()
    })

    document.querySelectorAll('[data-msound]').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-msound-preview]')) return
            document.querySelectorAll('[data-msound]').forEach(i => i.classList.remove('active'))
            item.classList.add('active')
        })
    })

    document.querySelectorAll('[data-msound-preview]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            previewMessengerSound(btn.dataset.msoundPreview)
        })
    })

    document.getElementById('saveMessengerSoundBtn').addEventListener('click', () => {
        if (!state.soundTargetId) return

        const messenger = getMessengerById(state.soundTargetId)
        if (!messenger) return

        const selected = document.querySelector('#messengerSoundList .sound-item.active')
        if (selected) messenger.notifSound = selected.dataset.msound

        saveData()
        document.getElementById('messengerSoundModal').classList.remove('show')
        state.soundTargetId = null
    })

    document.getElementById('closeMessengerSoundBtn').addEventListener('click', () => {
        document.getElementById('messengerSoundModal').classList.remove('show')
        state.soundTargetId = null
    })

    document.getElementById('messengerSoundModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('messengerSoundModal')) {
            document.getElementById('messengerSoundModal').classList.remove('show')
            state.soundTargetId = null
        }
    })
}

module.exports = {
    bindMessengerSoundUi
}