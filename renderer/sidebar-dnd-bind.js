function createSidebarDndApi({
    state,
    store,
    messengerList,
    moveMessengerToFolder
}) {
    // ── Порядок ──────────────────────────────────────────────────────────
    function saveOrder() {
        const order = []
        messengerList.querySelectorAll(':scope > [id^="sidebar-"], :scope > [id^="folder-"]').forEach(el => {
            if (el.id.startsWith('sidebar-')) {
                order.push({ type: 'messenger', id: el.id.replace('sidebar-', '') })
            } else if (el.id.startsWith('folder-')) {
                order.push({ type: 'folder', id: el.id.replace('folder-', '') })
            }
        })
        store.set('sidebarOrder', order)
    }

    function loadOrder() {
        const order = store.get('sidebarOrder', [])
        if (!order.length) return
        order.forEach(({ type, id }) => {
            const el = type === 'folder'
                ? document.getElementById(`folder-${id}`)
                : document.getElementById(`sidebar-${id}`)
            if (el && el.parentElement === messengerList) messengerList.appendChild(el)
        })
    }

    // ── Очистка состояния ─────────────────────────────────────────────────
    function clearDragState() {
        document.querySelectorAll('.drop-indicator-top, .drop-indicator-bottom, .folder-drop-target, .dragging')
            .forEach(el => el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'folder-drop-target', 'dragging'))
    }

    // ── Логика drop ───────────────────────────────────────────────────────
    function handleDrop(sourceId, sourceType, targetId, targetType, insertBefore, dropIntoFolder) {
        const sourceEl = document.getElementById(sourceType === 'folder' ? `folder-${sourceId}` : `sidebar-${sourceId}`)
        const targetEl = document.getElementById(targetType === 'folder' ? `folder-${targetId}` : `sidebar-${targetId}`)
        if (!sourceEl || !targetEl || sourceId === targetId) return

        // Мессенджер → папка (переместить внутрь)
        if (sourceType === 'messenger' && targetType === 'folder' && dropIntoFolder) {
            const messenger = state.activeMessengers.find(m => m.id === sourceId)
            if (messenger && messenger.folderId !== targetId) {
                moveMessengerToFolder(sourceId, targetId)
            }
            return
        }

        // Мессенджер → мессенджер или папка → папка (переупорядочить)
        if (sourceType === targetType) {
            if (targetEl.parentElement !== messengerList) return
            if (insertBefore) messengerList.insertBefore(sourceEl, targetEl)
            else messengerList.insertBefore(sourceEl, targetEl.nextSibling)
            saveOrder()
            return
        }

        // Мессенджер (в папке) → мессенджер (корень) → извлечь из папки
        if (sourceType === 'messenger' && targetType === 'messenger') {
            if (targetEl.parentElement !== messengerList) return
            const messenger = state.activeMessengers.find(m => m.id === sourceId)
            if (messenger && messenger.folderId) {
                moveMessengerToFolder(sourceId, null)
                // После перемещения элемент появится через addToSidebar, переставим его
                requestAnimationFrame(() => {
                    const movedEl = document.getElementById(`sidebar-${sourceId}`)
                    if (movedEl && targetEl) {
                        if (insertBefore) messengerList.insertBefore(movedEl, targetEl)
                        else messengerList.insertBefore(movedEl, targetEl.nextSibling)
                        saveOrder()
                    }
                })
            } else {
                if (insertBefore) messengerList.insertBefore(sourceEl, targetEl)
                else messengerList.insertBefore(sourceEl, targetEl.nextSibling)
                saveOrder()
            }
        }
    }

    // ── Инициализация перетаскивания элемента ─────────────────────────────
    function initDrag(el, id, type) {
        el.setAttribute('draggable', 'true')
        el.style.cursor = 'grab'

        el.addEventListener('dragstart', (e) => {
            state.dragSrcId = id
            state.dragSrcType = type
            setTimeout(() => el.classList.add('dragging'), 0)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', id)
            if (type === 'folder') {
                const header = el.querySelector('.folder-header')
                if (header) e.dataTransfer.setDragImage(header, 18, 18)
            }
        })

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging')
            clearDragState()
            state.dragSrcId = null
            state.dragSrcType = null
        })
    }

    // ── Зона drop для мессенджеров/папок (переупорядочение) ───────────────
    function initDropTarget(el, targetId, targetType) {
        el.addEventListener('dragover', (e) => {
            e.preventDefault()
            if (!state.dragSrcId || state.dragSrcId === targetId) return

            // Если тащим мессенджер на заголовок папки → отдельный обработчик
            if (state.dragSrcType === 'messenger' && targetType === 'folder') {
                clearDragState()
                el.classList.add('folder-drop-target')
                e.dataTransfer.dropEffect = 'move'
                return
            }

            const rect = el.getBoundingClientRect()
            const insertBefore = e.clientY < rect.top + rect.height / 2
            clearDragState()
            el.classList.add(insertBefore ? 'drop-indicator-top' : 'drop-indicator-bottom')
            e.dataTransfer.dropEffect = 'move'
        })

        el.addEventListener('dragleave', (e) => {
            if (!el.contains(e.relatedTarget)) {
                el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'folder-drop-target')
            }
        })

        el.addEventListener('drop', (e) => {
            e.preventDefault()
            const dropIntoFolder = el.classList.contains('folder-drop-target')
            el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'folder-drop-target')
            if (!state.dragSrcId || state.dragSrcId === targetId) return

            const rect = el.getBoundingClientRect()
            const insertBefore = e.clientY < rect.top + rect.height / 2
            handleDrop(state.dragSrcId, state.dragSrcType, targetId, targetType, insertBefore, dropIntoFolder)
        })
    }

    // ── Drop-зона «корень» внизу списка ──────────────────────────────────
    function initRootDropZone() {
        const zone = document.createElement('div')
        zone.className = 'sidebar-root-drop-zone'
        messengerList.appendChild(zone)

        zone.addEventListener('dragover', (e) => {
            e.preventDefault()
            if (!state.dragSrcId) return
            zone.classList.add('active')
            e.dataTransfer.dropEffect = 'move'
        })

        zone.addEventListener('dragleave', () => zone.classList.remove('active'))

        zone.addEventListener('drop', (e) => {
            e.preventDefault()
            zone.classList.remove('active')
            if (!state.dragSrcId || state.dragSrcType !== 'messenger') return
            const messenger = state.activeMessengers.find(m => m.id === state.dragSrcId)
            if (messenger && messenger.folderId) {
                moveMessengerToFolder(state.dragSrcId, null)
            } else {
                const sourceEl = document.getElementById(`sidebar-${state.dragSrcId}`)
                if (sourceEl) messengerList.insertBefore(sourceEl, zone)
                saveOrder()
            }
        })

        return zone
    }

    return {
        initDrag,
        initDropTarget,
        initRootDropZone,
        handleDrop,
        saveOrder,
        loadOrder
    }
}

module.exports = {
    createSidebarDndApi
}
