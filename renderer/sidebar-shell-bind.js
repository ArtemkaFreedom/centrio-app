function bindSidebarShellUi({
    state,
    hideAllMenus,
    closeFolderPanel,
    toggleMuteAll,
    updateUnreadCount,
    updateMuteIcon,
    getActiveMessengers,
    getRawUnreadCount,
    sidebarContextMenu,
    tGet
}) {
    function showSidebarContextMenuAt(x, y) {
        hideAllMenus()

        sidebarContextMenu.style.left = `${x}px`
        sidebarContextMenu.style.top = `${y}px`
        sidebarContextMenu.classList.add('show')

        const rect = sidebarContextMenu.getBoundingClientRect()
        if (rect.right > window.innerWidth) {
            sidebarContextMenu.style.left = `${x - rect.width}px`
        }
        if (rect.bottom > window.innerHeight) {
            sidebarContextMenu.style.top = `${y - rect.height}px`
        }
    }

    document.addEventListener('click', () => hideAllMenus())

    document.getElementById('folderPanelClose')?.addEventListener('click', () => {
        closeFolderPanel()
    })

    document.getElementById('messengerList')?.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.messenger-item') || e.target.closest('.folder-item')) return

        e.preventDefault()
        e.stopPropagation()
        showSidebarContextMenuAt(e.clientX, e.clientY)
    })

    document.querySelector('.activity-bar')?.addEventListener('contextmenu', (e) => {
        if (
            e.target.closest('.messenger-item') ||
            e.target.closest('.folder-item') ||
            e.target.closest('.activity-btn')
        ) return

        e.preventDefault()
        e.stopPropagation()
        showSidebarContextMenuAt(e.clientX, e.clientY)
    })
}

module.exports = {
    bindSidebarShellUi
}