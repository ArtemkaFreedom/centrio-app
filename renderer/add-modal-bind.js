function bindAddModalUi({
    state,
    PAGE_SIZE,
    popularMessengers,
    addModal,
    closeModal,
    openModal,
    fillMessengerGrid,
    addMessenger,
    requirePro,
    tGet
}) {
    document.getElementById('addMessengerBtn')?.addEventListener('click', () => openModal())
    document.getElementById('welcomeAddBtn')?.addEventListener('click', () => openModal())
    document.getElementById('closeModalBtn')?.addEventListener('click', () => closeModal())

    document.getElementById('messengerGrid')?.addEventListener('wheel', (e) => {
        e.preventDefault()
        const totalPages = Math.ceil(state.modalFiltered.length / PAGE_SIZE)

        if (e.deltaY > 0 && state.modalPage < totalPages - 1) {
            state.modalPage++
            fillMessengerGrid()
        } else if (e.deltaY < 0 && state.modalPage > 0) {
            state.modalPage--
            fillMessengerGrid()
        }
    }, { passive: false })

    document.getElementById('modalSearchInput')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim()
        state.modalPage = 0
        state.modalFiltered = q
            ? popularMessengers.filter(m => m.name.toLowerCase().includes(q))
            : [...popularMessengers]
        fillMessengerGrid()
    })

    document.getElementById('customToggleBtn')?.addEventListener('click', () => {
        document.getElementById('customSection')?.classList.toggle('open')
    })

    document.getElementById('addCustomBtn')?.addEventListener('click', () => {
        // Добавление своего мессенджера — только для PRO
        if (requirePro && !requirePro('customMessenger')) return

        const name = document.getElementById('customName')?.value.trim()
        const url = document.getElementById('customUrl')?.value.trim()

        if (!name || !url) {
            alert(tGet('errors.fillAll'))
            return
        }

        if (!url.startsWith('http')) {
            alert(tGet('errors.httpOnly'))
            return
        }

        let hostname = ''
        try {
            hostname = new URL(url).hostname
        } catch {
            alert(tGet('errors.badUrl'))
            return
        }

        addMessenger({
            name,
            url,
            icon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
            color: '#7b68ee'
        })

        closeModal()

        const customName = document.getElementById('customName')
        const customUrl = document.getElementById('customUrl')
        if (customName) customName.value = ''
        if (customUrl) customUrl.value = ''
    })

    addModal?.addEventListener('click', (e) => {
        if (e.target === addModal) closeModal()
    })
}

module.exports = {
    bindAddModalUi
}