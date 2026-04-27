function createAddModalUiApi({
    state,
    popularMessengers,
    PAGE_SIZE,
    addModal,
    messengerGrid,
    addMessenger
}) {
    function fillMessengerGrid() {
        messengerGrid.innerHTML = ''

        const start = state.modalPage * PAGE_SIZE
        const page = state.modalFiltered.slice(start, start + PAGE_SIZE)
        const totalPages = Math.ceil(state.modalFiltered.length / PAGE_SIZE)

        page.forEach(messenger => {
            const item = document.createElement('div')
            item.className = 'messenger-grid-item'

            const hostname = (() => {
                try { return new URL(messenger.url).hostname } catch { return '' }
            })()

            item.innerHTML = `
                <img src="${messenger.icon}"
                     onerror="this.src='https://www.google.com/s2/favicons?domain=${hostname}&sz=64'"
                     alt="${messenger.name}">
                <span>${messenger.name}</span>
            `

            item.addEventListener('click', () => {
                addMessenger(messenger)
                closeModal()
            })

            messengerGrid.appendChild(item)
        })

        const pager = document.getElementById('modalPager')
        pager.innerHTML = ''

        if (totalPages > 1) {
            for (let i = 0; i < totalPages; i++) {
                const dot = document.createElement('div')
                dot.className = 'modal-page-dot' + (i === state.modalPage ? ' active' : '')
                dot.title = `${i + 1}`
                dot.addEventListener('click', () => {
                    state.modalPage = i
                    fillMessengerGrid()
                })
                pager.appendChild(dot)
            }
        }
    }

    function openModal() {
        state.modalPage = 0
        state.modalFiltered = [...popularMessengers]
        addModal.classList.add('show')
        fillMessengerGrid()
        document.getElementById('modalSearchInput').value = ''
        document.getElementById('customSection').classList.remove('open')
        setTimeout(() => document.getElementById('modalSearchInput').focus(), 100)
    }

    function closeModal() {
        addModal.classList.remove('show')
    }

    return {
        fillMessengerGrid,
        openModal,
        closeModal
    }
}

module.exports = {
    createAddModalUiApi
}