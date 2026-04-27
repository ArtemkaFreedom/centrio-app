function createChangeIconUiApi({
    state,
    applyI18n
}) {
    function openChangeIconModal(messengerId, getMessengerById) {
        const messenger = getMessengerById(messengerId)
        if (!messenger) return

        state.changeIconNewSrc = null
        document.getElementById('changeIconUrl').value = ''
        document.getElementById('changeIconModal').classList.add('show')
        updateChangeIconPreview(messenger.icon, messenger.name)
        applyI18n()
    }

    function updateChangeIconPreview(src, name) {
        const img = document.getElementById('changeIconPreviewImg')
        const letter = document.getElementById('changeIconPreviewLetter')
        if (!img || !letter) return

        if (src) {
            img.src = src
            img.classList.remove('hidden')
            img.onload = () => {
                letter.textContent = ''
                img.classList.remove('hidden')
            }
            img.onerror = () => {
                img.classList.add('hidden')
                letter.textContent = name?.[0]?.toUpperCase() || '?'
            }
        } else {
            img.classList.add('hidden')
            letter.textContent = name?.[0]?.toUpperCase() || '?'
        }
    }

    function readIconFile(file, getMessengerById) {
        const reader = new FileReader()
        reader.onload = (ev) => {
            state.changeIconNewSrc = ev.target.result
            const messenger = getMessengerById(state.changeIconTargetId)
            updateChangeIconPreview(state.changeIconNewSrc, messenger?.name || '')
        }
        reader.readAsDataURL(file)
    }

    return {
        openChangeIconModal,
        updateChangeIconPreview,
        readIconFile
    }
}

module.exports = {
    createChangeIconUiApi
}