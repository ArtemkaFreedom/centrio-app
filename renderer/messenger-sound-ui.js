function createMessengerSoundUiApi({ requirePro } = {}) {
    function openMessengerSoundModal(messengerId, getMessengerById) {
        if (requirePro && !requirePro('sound')) return

        const messenger = getMessengerById(messengerId)
        if (!messenger) return

        const current = messenger.notifSound || '__default__'
        document.querySelectorAll('#messengerSoundList .sound-item').forEach(item => {
            item.classList.toggle('active', item.dataset.msound === current)
        })

        document.getElementById('messengerSoundModal').classList.add('show')
    }

    return {
        openMessengerSoundModal
    }
}

module.exports = {
    createMessengerSoundUiApi
}