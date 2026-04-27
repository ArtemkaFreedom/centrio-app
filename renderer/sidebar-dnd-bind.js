function createSidebarDndApi({
    state,
    store,
    messengerList,
    moveMessengerToFolder
}) {
    function saveOrder() {
        const order = []
        messengerList.querySelectorAll('[id^="sidebar-"], [id^="folder-"]').forEach(el => {
            if (el.id.startsWith('sidebar-')) {
                order.push({ type: 'messenger', id: el.id.replace('sidebar-', '') })
            } else if (el.id.startsWith('folder-')) {
                order.push({ type: 'folder', id: el.id.replace('folder-', '') })
            }
        })
        store.set('sidebarOrder', order)
    }

    function handleDrop(sourceId, sourceType, targetId, targetType, insertBefore) {
        const sourceEl = sourceType === 'folder'
            ? document.getElementById(`folder-${sourceId}`)
            : document.getElementById(`sidebar-${sourceId}`)

        const targetEl = targetType === 'folder'
            ? document.getElementById(`folder-${targetId}`)
            : document.getElementById(`sidebar-${targetId}`)

        if (!sourceEl || !targetEl) return

        if (sourceType === 'messenger' && targetType === 'folder') {
            const messenger = state.activeMessengers.find(m => m.id === sourceId)
            if (messenger && !messenger.folderId) {
                moveMessengerToFolder(sourceId, targetId)
                return
            }
        }

        if (insertBefore) messengerList.insertBefore(sourceEl, targetEl)
        else messengerList.insertBefore(sourceEl, targetEl.nextSibling)

        saveOrder()
    }

    function initDrag(el, id, type) {
        el.setAttribute('draggable', 'true')

        el.addEventListener('dragstart', (e) => {
            state.dragSrcId = id
            state.dragSrcType = type
            el.classList.add('dragging')
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', id)
        })

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging')
            document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'))
            document.querySelectorAll('.drop-indicator-top, .drop-indicator-bottom')
                .forEach(x => x.classList.remove('drop-indicator-top', 'drop-indicator-bottom'))
            state.dragSrcId = null
            state.dragSrcType = null
        })
    }

    function initDropTarget(el, targetId, targetType) {
        el.addEventListener('dragover', (e) => {
            e.preventDefault()
            if (!state.dragSrcId || state.dragSrcId === targetId) return

            const rect = el.getBoundingClientRect()
            const insertBefore = e.clientY < rect.top + rect.height / 2

            document.querySelectorAll('.drop-indicator-top, .drop-indicator-bottom')
                .forEach(d => d.classList.remove('drop-indicator-top', 'drop-indicator-bottom'))

            el.classList.add(insertBefore ? 'drop-indicator-top' : 'drop-indicator-bottom')
            e.dataTransfer.dropEffect = 'move'
        })

        el.addEventListener('dragleave', (e) => {
            if (!el.contains(e.relatedTarget)) {
                el.classList.remove('drop-indicator-top', 'drop-indicator-bottom')
            }
        })

        el.addEventListener('drop', (e) => {
            e.preventDefault()
            el.classList.remove('drop-indicator-top', 'drop-indicator-bottom')
            if (!state.dragSrcId || state.dragSrcId === targetId) return

            const rect = el.getBoundingClientRect()
            const insertBefore = e.clientY < rect.top + rect.height / 2
            handleDrop(state.dragSrcId, state.dragSrcType, targetId, targetType, insertBefore)
        })
    }

    return {
        initDrag,
        initDropTarget,
        handleDrop,
        saveOrder
    }
}

module.exports = {
    createSidebarDndApi
}