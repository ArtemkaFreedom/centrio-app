function createFoldersUiApi({
    state,
    store,
    folderPanel,
    messengerList,
    renderMessengerItem,
    addToSidebar,
    saveData
}) {
    function updateFolderBadge(folderId) {
        const folderEl = document.getElementById(`folder-${folderId}`)
        if (!folderEl) return

        const total = state.activeMessengers
            .filter(m => m.folderId === folderId)
            .reduce((sum, m) => sum + (state.unreadCounts[m.id] || 0), 0)

        const iconWrap = folderEl.querySelector('.folder-icon-wrap')
        if (!iconWrap) return

        let badge = iconWrap.querySelector('.folder-badge')
        if (total > 0) {
            if (!badge) {
                badge = document.createElement('span')
                badge.className = 'folder-badge'
                iconWrap.appendChild(badge)
            }
            badge.textContent = total > 99 ? '99+' : total
        } else {
            badge?.remove()
        }
    }

    function renderFolderPanel(folderId) {
        const content = document.getElementById('folderPanelContent')
        content.innerHTML = ''

        state.activeMessengers
            .filter(m => m.folderId === folderId)
            .forEach(messenger => {
                const item = renderMessengerItem(messenger)
                item.removeAttribute('title')

                const count = state.unreadCounts[messenger.id] || 0
                if (count > 0) {
                    let badge = item.querySelector('.messenger-badge')
                    if (!badge) {
                        badge = document.createElement('span')
                        badge.className = 'messenger-badge'
                        item.appendChild(badge)
                    }
                    badge.textContent = count > 99 ? '99+' : count
                }

                content.appendChild(item)
            })
    }

    function updateFolderPanelPosition() {
        const activityBar = document.querySelector('.activity-bar')
        const rect = activityBar.getBoundingClientRect()
        folderPanel.style.left = `${rect.right}px`
        folderPanel.style.top = '36px'
        folderPanel.style.bottom = '26px'
    }

    function openFolderPanel(folderId) {
        const folder = state.folders.find(f => f.id === folderId)
        if (!folder) return

        document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('open'))
        state.activeFolderPanelId = folderId

        const folderEl = document.getElementById(`folder-${folderId}`)
        if (folderEl) folderEl.classList.add('open')

        document.getElementById('folderPanelName').textContent = folder.name
        renderFolderPanel(folderId)
        folderPanel.classList.add('open')
        document.querySelector('.main-container').classList.add('folder-panel-open')
        updateFolderPanelPosition()
    }

    function closeFolderPanel() {
        state.activeFolderPanelId = null
        folderPanel.classList.remove('open')
        document.querySelector('.main-container').classList.remove('folder-panel-open')
        document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('open'))
    }

    function toggleFolderPanel(folderId) {
        if (state.activeFolderPanelId === folderId) closeFolderPanel()
        else openFolderPanel(folderId)
    }

    function addToFolder(messenger, folderId) {
        const container = document.getElementById(`folder-children-${folderId}`)
        if (!container) return
        container.appendChild(renderMessengerItem(messenger))
        document.getElementById(`folder-${folderId}`)?.classList.add('open')
    }

    function removeFolder(folderId) {
        state.activeMessengers.filter(m => m.folderId === folderId).forEach(m => {
            m.folderId = null
            if (typeof addToSidebar === 'function') addToSidebar(m)
        })
        document.getElementById(`folder-${folderId}`)?.remove()
        state.folders = state.folders.filter(f => f.id !== folderId)
        saveData()
    }

    function applyFoldersEnabled(enabled) {
        if (enabled) {
            document.querySelectorAll('.folder-item').forEach(f => { f.style.display = 'flex' })
            state.activeMessengers.forEach(m => {
                if (m.folderId) {
                    const el = document.getElementById(`sidebar-${m.id}`)
                    if (el && el.closest('.folder-item') === null) el.remove()
                }
            })
        } else {
            document.querySelectorAll('.folder-item').forEach(f => { f.style.display = 'none' })
            closeFolderPanel()
            state.activeMessengers.forEach(m => {
                document.getElementById(`sidebar-${m.id}`)?.remove()
                messengerList.appendChild(renderMessengerItem(m))
            })
        }
        store.set('foldersEnabled', enabled)
    }

    return {
        updateFolderBadge,
        renderFolderPanel,
        updateFolderPanelPosition,
        openFolderPanel,
        closeFolderPanel,
        toggleFolderPanel,
        addToFolder,
        removeFolder,
        applyFoldersEnabled
    }
}

module.exports = {
    createFoldersUiApi
}