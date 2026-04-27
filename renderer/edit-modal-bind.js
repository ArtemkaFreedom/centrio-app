function bindEditModalUi({
    state,
    editModal,
    folderIcons,
    saveData,
    moveMessengerToFolder,
    renderFolder,
    addToSidebar,
    getFolderById,
    getMessengerById
}) {
    const closeEditModal = () => {
        editModal.classList.remove('show')
    }

    document.getElementById('closeEditModalBtn')?.addEventListener('click', () => {
        closeEditModal()
    })

    document.getElementById('editName')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('saveEditBtn')?.click()
    })

    editModal?.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal()
    })

    document.getElementById('saveEditBtn')?.addEventListener('click', () => {
        const editNameInput = document.getElementById('editName')
        const saveBtn = document.getElementById('saveEditBtn')
        const newName = editNameInput?.value.trim()

        if (!newName) {
            if (editNameInput) editNameInput.style.borderColor = 'var(--danger)'
            return
        }

        if (editNameInput) editNameInput.style.borderColor = ''

        if (state.editMode === 'messenger') {
            const targetId = saveBtn?.dataset.pendingMessengerId
            const messenger = getMessengerById(targetId)
            if (!messenger) {
                closeEditModal()
                return
            }

            messenger.name = newName
            document.getElementById(`sidebar-${messenger.id}`)?.setAttribute('title', newName)

            const tab = document.getElementById(`tab-${messenger.id}`)
            const nameEl = tab?.querySelector('.tab-name')
            if (nameEl) nameEl.textContent = newName

            saveData()
            closeEditModal()
            return
        }

        if (state.editMode === 'folder') {
            const targetId = saveBtn?.dataset.pendingMessengerId
            const folder = getFolderById(targetId)
            if (!folder) {
                closeEditModal()
                return
            }

            folder.name = newName
            folder.icon = state.selectedFolderIcon

            const folderHeader = document.querySelector(`#folder-${folder.id} .folder-header`)
            if (folderHeader) {
                folderHeader.title = newName
                const iconWrap = folderHeader.querySelector('.folder-icon-wrap')
                if (iconWrap) {
                    const badge = iconWrap.querySelector('.folder-badge')
                    iconWrap.innerHTML = folderIcons[state.selectedFolderIcon] || folderIcons.folder
                    if (badge) iconWrap.appendChild(badge)
                }
            }

            saveData()
            closeEditModal()
            return
        }

        if (state.editMode === 'newFolder') {
            const folder = {
                id: Date.now().toString(),
                name: newName,
                icon: state.selectedFolderIcon
            }

            state.folders.push(folder)
            renderFolder(folder)

            const pendingId = saveBtn?.dataset.pendingMessengerId
            if (pendingId) moveMessengerToFolder(pendingId, folder.id)

            saveData()
            closeEditModal()
        }
    })
}

module.exports = {
    bindEditModalUi
}