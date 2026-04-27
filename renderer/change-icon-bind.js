function bindChangeIconUi({
    state,
    saveData,
    hideAllMenus,
    openChangeIconModal,
    updateChangeIconPreview,
    readIconFile,
    getMessengerById
}) {
    document.getElementById('ctxChangeIcon').addEventListener('click', () => {
        if (!state.contextTargetId) return
        state.changeIconTargetId = state.contextTargetId
        openChangeIconModal(state.contextTargetId, getMessengerById)
        hideAllMenus()
    })

    document.getElementById('changeIconUrlApplyBtn').addEventListener('click', () => {
        const url = document.getElementById('changeIconUrl').value.trim()
        if (!url) return
        state.changeIconNewSrc = url
        const messenger = getMessengerById(state.changeIconTargetId)
        updateChangeIconPreview(url, messenger?.name || '')
    })

    document.getElementById('changeIconUrl').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('changeIconUrlApplyBtn').click()
    })

    document.getElementById('changeIconFile').addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (file) readIconFile(file, getMessengerById)
    })

    const dropZone = document.getElementById('changeIconDropZone')

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropZone.classList.add('drag-over')
    })

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over')
    })

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault()
        dropZone.classList.remove('drag-over')
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('image/')) {
            readIconFile(file, getMessengerById)
        }
    })

    document.getElementById('changeIconResetBtn').addEventListener('click', () => {
        const messenger = getMessengerById(state.changeIconTargetId)
        if (!messenger) return

        const hostname = (() => {
            try { return new URL(messenger.url).hostname } catch { return '' }
        })()

        state.changeIconNewSrc = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
        updateChangeIconPreview(state.changeIconNewSrc, messenger.name)
    })

    document.getElementById('changeIconSaveBtn').addEventListener('click', () => {
        if (!state.changeIconTargetId) return
        const messenger = getMessengerById(state.changeIconTargetId)
        if (!messenger) return

        const newIcon = state.changeIconNewSrc || messenger.icon
        messenger.icon = newIcon
        messenger.customIcon = true

        const sidebarItem = document.getElementById(`sidebar-${messenger.id}`)
        if (sidebarItem) {
            const img = sidebarItem.querySelector('.messenger-icon')
            if (img) {
                img.src = newIcon
                img.dataset.sources = JSON.stringify([newIcon])
            }
        }

        saveData()
        document.getElementById('changeIconModal').classList.remove('show')
        state.changeIconTargetId = null
        state.changeIconNewSrc = null
    })

    document.getElementById('closeChangeIconBtn').addEventListener('click', () => {
        document.getElementById('changeIconModal').classList.remove('show')
        state.changeIconTargetId = null
        state.changeIconNewSrc = null
    })

    document.getElementById('changeIconModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('changeIconModal')) {
            document.getElementById('changeIconModal').classList.remove('show')
            state.changeIconTargetId = null
            state.changeIconNewSrc = null
        }
    })
}

module.exports = {
    bindChangeIconUi
}