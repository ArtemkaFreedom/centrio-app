function createWebviewTabsApi({
    state,
    tabsBar,
    tabsContent,
    findCount,
    webviewContextMenu,
    preloadPath,
    ipcRenderer,
    invokeIpc,
    tGet,
    openFindBar,
    openSettings,
    getActiveWebview,
    applyTabZoom,
    switchTab,
    removeMessenger,
    watchWebview,
    showContextMenu
}) {
    if (webviewContextMenu && webviewContextMenu.parentElement !== document.body) {
        document.body.appendChild(webviewContextMenu)
    }

    function hideWebviewContextMenu() {
        if (!webviewContextMenu) return
        webviewContextMenu.classList.remove('show')
        webviewContextMenu.style.visibility = ''
    }

    function bindGlobalMenuClose() {
        if (document.__centrioWebviewMenuCloseBound) return
        document.__centrioWebviewMenuCloseBound = true

        document.addEventListener('mousedown', (e) => {
            if (!webviewContextMenu) return
            if (!webviewContextMenu.classList.contains('show')) return
            if (webviewContextMenu.contains(e.target)) return

            hideWebviewContextMenu()
        })

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return
            hideWebviewContextMenu()
        })

        window.addEventListener('blur', () => {
            hideWebviewContextMenu()
        })

        window.addEventListener('resize', () => {
            hideWebviewContextMenu()
        })

        document.addEventListener('scroll', () => {
            hideWebviewContextMenu()
        }, true)
    }

    async function confirmRemoveMessenger(messenger) {
        const message = tGet("webview.removeConfirm").replace("{name}", messenger.name)

        if (typeof window.showConfirmModal === 'function') {
            return await window.showConfirmModal({
                title: tGet("webview.removeTitle"),
                message,
                confirmText: tGet("webview.removeBtn"),
                cancelText: tGet("webview.cancelBtn"),
                danger: true
            })
        }

        return window.confirm(message)
    }

    function addTab(messenger) {
        const tab = document.createElement('div')
        tab.className = 'tab'
        tab.id = `tab-${messenger.id}`

        const hostname = (() => {
            try {
                return new URL(messenger.url).hostname
            } catch {
                return ''
            }
        })()

        const tabMain = document.createElement('div')
        tabMain.className = 'tab-main'

        const icon = document.createElement('img')
        icon.width = 16
        icon.height = 16
        icon.className = 'tab-icon'
        icon.src = messenger.icon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
        icon.onerror = () => {
            if (icon.src.includes('logomessenger') || icon.src.includes('assets')) {
                icon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
                icon.onerror = () => { icon.style.display = 'none' }
            } else {
                icon.style.display = 'none'
            }
        }

        const title = document.createElement('span')
        title.className = 'tab-name'
        title.textContent = messenger.name

        const closeBtn = document.createElement('button')
        closeBtn.className = 'tab-close'
        closeBtn.type = 'button'
        closeBtn.setAttribute('aria-label', tGet("webview.removeTabLabel").replace("{name}", messenger.name))
        closeBtn.setAttribute('title', tGet("webview.removeTabLabel").replace("{name}", messenger.name))
        closeBtn.dataset.id = messenger.id
        closeBtn.textContent = '✕'

        tabMain.appendChild(icon)
        tabMain.appendChild(title)
        tab.appendChild(tabMain)
        tab.appendChild(closeBtn)

        tab.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) return
            switchTab(messenger.id)
        })

        closeBtn.addEventListener('click', async (e) => {
            e.preventDefault()
            e.stopPropagation()

            const confirmed = await confirmRemoveMessenger(messenger)
            if (!confirmed) return

            removeMessenger(messenger.id)
        })

        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            e.stopPropagation()

            switchTab(messenger.id)

            if (typeof showContextMenu === 'function') {
                showContextMenu(e, messenger.id)
            }
        })

        initTabDrag(tab, messenger.id)
        tabsBar.appendChild(tab)
    }

    let _tabDragSrcId = null

    function initTabDrag(tab, messengerId) {
        tab.setAttribute('draggable', 'true')

        tab.addEventListener('dragstart', (e) => {
            _tabDragSrcId = messengerId
            setTimeout(() => tab.classList.add('tab-dragging'), 0)
            e.dataTransfer.effectAllowed = 'move'
            e.stopPropagation()
        })

        tab.addEventListener('dragend', () => {
            tab.classList.remove('tab-dragging')
            tabsBar.querySelectorAll('.tab').forEach(t =>
                t.classList.remove('tab-drop-before', 'tab-drop-after'))
            _tabDragSrcId = null
        })

        tab.addEventListener('dragover', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!_tabDragSrcId || _tabDragSrcId === messengerId) return
            const rect = tab.getBoundingClientRect()
            const insertBefore = e.clientX < rect.left + rect.width / 2
            tabsBar.querySelectorAll('.tab').forEach(t =>
                t.classList.remove('tab-drop-before', 'tab-drop-after'))
            tab.classList.add(insertBefore ? 'tab-drop-before' : 'tab-drop-after')
            e.dataTransfer.dropEffect = 'move'
        })

        tab.addEventListener('dragleave', (e) => {
            if (!tab.contains(e.relatedTarget))
                tab.classList.remove('tab-drop-before', 'tab-drop-after')
        })

        tab.addEventListener('drop', (e) => {
            e.preventDefault()
            e.stopPropagation()
            tab.classList.remove('tab-drop-before', 'tab-drop-after')
            if (!_tabDragSrcId || _tabDragSrcId === messengerId) return
            const srcTab = document.getElementById(`tab-${_tabDragSrcId}`)
            if (!srcTab) return
            const rect = tab.getBoundingClientRect()
            const insertBefore = e.clientX < rect.left + rect.width / 2
            if (insertBefore) tabsBar.insertBefore(srcTab, tab)
            else tabsBar.insertBefore(srcTab, tab.nextSibling)
        })
    }

    function attachFindListener(webview) {
        webview.addEventListener('found-in-page', (e) => {
            const { activeMatchOrdinal, matches } = e.result
            if (matches > 0) {
                findCount.textContent = `${activeMatchOrdinal} / ${matches}`
                findCount.style.color = 'var(--text-secondary)'
            } else {
                findCount.textContent = tGet('search.notFound')
                findCount.style.color = 'var(--danger)'
            }
        })
    }

    function attachContextMenu(webview, messenger) {
        webview.addEventListener('ipc-message', (e) => {
            if (e.channel === 'close-context-menu') {
                hideWebviewContextMenu()
                return
            }

            if (e.channel === 'image-data') {
                const dataUrl = e.args[0]
                if (dataUrl) {
                    if (state._wvCopyMode) {
                        // Копируем в буфер обмена через главный процесс
                        invokeIpc('copy-image-to-clipboard', dataUrl).catch(() => {})
                    } else {
                        // Сохраняем в файл
                        ipcRenderer.send('save-image-data', dataUrl, state.wvContextParams._filePath || '')
                    }
                }
                state._wvCopyMode = false
                return
            }

            // Горячие клавиши, пересланные из webview (когда фокус внутри)
            if (e.channel === 'keyboard-shortcut') {
                const shortcut = e.args[0]
                if (!shortcut) return

                if (shortcut === 'ctrl+r') {
                    if (state.activeTabId) {
                        document.getElementById(`webview-${state.activeTabId}`)?.reload()
                    }
                    return
                }

                if (shortcut === 'ctrl+tab') {
                    if (!state.activeMessengers.length) return
                    const idx = state.activeMessengers.findIndex(m => m.id === state.activeTabId)
                    if (idx === -1) return
                    switchTab(state.activeMessengers[(idx + 1) % state.activeMessengers.length].id)
                    return
                }

                if (shortcut === 'ctrl+shift+tab') {
                    if (!state.activeMessengers.length) return
                    const idx = state.activeMessengers.findIndex(m => m.id === state.activeTabId)
                    if (idx === -1) return
                    switchTab(state.activeMessengers[(idx - 1 + state.activeMessengers.length) % state.activeMessengers.length].id)
                    return
                }

                const numMatch = shortcut.match(/^ctrl\+(\d)$/)
                if (numMatch) {
                    const idx = parseInt(numMatch[1]) - 1
                    if (state.activeMessengers[idx]) switchTab(state.activeMessengers[idx].id)
                    return
                }

                if (shortcut === 'ctrl+f') {
                    if (typeof openFindBar === 'function') openFindBar()
                    return
                }

                if (shortcut === 'ctrl+comma') {
                    if (typeof openSettings === 'function') openSettings()
                    return
                }

                return
            }

            if (e.channel !== 'context-menu') return

            // Переключаемся на нужный мессенджер, чтобы zoom применялся правильно
            if (messenger?.id && state.activeTabId !== messenger.id) {
                switchTab(messenger.id)
            }

            const params = e.args[0] || {}
            state.wvContextParams = params

            document.querySelectorAll('.context-menu').forEach((m) => {
                m.classList.remove('show')
                m.style.visibility = ''
            })

            const saveImageItem = document.getElementById('wvSaveImage')
            if (saveImageItem) {
                saveImageItem.style.display = params.mediaType === 'image' ? 'flex' : 'none'
            }

            const copyItem = document.getElementById('wvCopy')
            if (copyItem) {
                const hasCopy = params.mediaType === 'image' || !!params.selectionText
                copyItem.style.display = hasCopy ? 'flex' : 'none'
                const dividerAfterCopy = copyItem.nextElementSibling
                if (dividerAfterCopy?.classList.contains('context-divider')) {
                    dividerAfterCopy.style.display = hasCopy ? '' : 'none'
                }
            }

            const translateItem = document.getElementById('ctxTranslate')
            if (translateItem) {
                translateItem.style.display = params.selectionText ? 'flex' : 'none'
                const divider = translateItem.nextElementSibling
                if (divider?.classList.contains('context-divider')) {
                    divider.style.display = params.selectionText ? 'block' : 'none'
                }
            }

            const webviewRect = webview.getBoundingClientRect()
            const localX = Number(params.clientX ?? params.x ?? 0)
            const localY = Number(params.clientY ?? params.y ?? 0)
            const zoom = Number(state.tabZoomLevel || 1)
            const margin = 8
            const pointerOffset = 2

            let left = webviewRect.left + localX * zoom + pointerOffset
            let top = webviewRect.top + localY * zoom + pointerOffset

            webviewContextMenu.style.position = 'fixed'
            webviewContextMenu.style.left = '0px'
            webviewContextMenu.style.top = '0px'
            webviewContextMenu.style.visibility = 'hidden'
            webviewContextMenu.classList.add('show')

            requestAnimationFrame(() => {
                const menuRect = webviewContextMenu.getBoundingClientRect()

                const fitsBelow = top + menuRect.height <= window.innerHeight - margin
                const fitsRight = left + menuRect.width <= window.innerWidth - margin

                if (!fitsBelow) {
                    top = top - menuRect.height - pointerOffset * 2
                }

                if (!fitsRight) {
                    left = left - menuRect.width - pointerOffset * 2
                }

                const maxLeft = window.innerWidth - menuRect.width - margin
                const maxTop = window.innerHeight - menuRect.height - margin

                if (left > maxLeft) left = Math.max(margin, maxLeft)
                if (top > maxTop) top = Math.max(margin, maxTop)

                if (left < margin) left = margin
                if (top < margin) top = margin

                webviewContextMenu.style.left = `${Math.round(left)}px`
                webviewContextMenu.style.top = `${Math.round(top)}px`
                webviewContextMenu.style.visibility = 'visible'
            })
        })
    }

    function addWebview(messenger) {
        invokeIpc('ext:apply-to-session', `persist:${messenger.id}`).catch(() => {})
        const webview = document.createElement('webview')
        webview.id = `webview-${messenger.id}`
        webview.src = messenger.url
        webview.setAttribute('allowpopups', 'true')
        webview.setAttribute('partition', `persist:${messenger.id}`)
        webview.setAttribute(
            'useragent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        webview.setAttribute('preload', preloadPath)

        const applyInitialZoom = () => {
            const zoomLevel = typeof messenger.zoomLevel === 'number'
                ? messenger.zoomLevel
                : Number(state.tabZoomLevel || 1)

            try {
                webview.setZoomFactor(zoomLevel)
            } catch {}
        }

        webview.addEventListener('dom-ready', () => {
            applyInitialZoom()

            if (messenger.forceDarkMode) {
                const css = `
                    html { filter: invert(1) hue-rotate(180deg) !important; }
                    img, video, canvas, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }
                `
                webview.insertCSS(css)
            }

        })

        webview.addEventListener('did-finish-load', applyInitialZoom)


        webview.addEventListener('new-window', (e) => {
            e.preventDefault()
            const url = e.url
            if (!url || url === 'about:blank') return
            if (url.startsWith('chrome-extension://')) {
                // Webview-shell обход: грузим data:HTML с <webview src> — webview guest
                // navigations идут другим code-path и не блокируются ExtensionNavigationThrottle.
                invokeIpc('open-popup-window', url, {
                    width:     e.frameName === 'popup' ? 380 : 400,
                    height:    600,
                    partition: messenger?.id ? `persist:${messenger.id}` : 'persist:ext-popup',
                }).catch(() => {})
                return
            }
            ipcRenderer.send('open-url', url)
        })

        webview.addEventListener('will-navigate', (e) => {
            const url = e.url
            if (!url) return
            try {
                const messengerHost = new URL(messenger.url).hostname
                const navHost = new URL(url).hostname
                if (navHost !== messengerHost && !url.startsWith('file://')) {
                    e.preventDefault()
                    ipcRenderer.send('open-url', url)
                }
            } catch {}
        })

        webview.addEventListener('did-fail-load', (e) => {
            if (e.errorCode !== -3) webview.loadURL(messenger.url)
        })

        watchWebview(webview, messenger)
        attachFindListener(webview)
        attachContextMenu(webview, messenger)

        tabsContent.appendChild(webview)
        tabsContent.style.pointerEvents = 'auto'
    }

    function bindWebviewContextMenuActions() {
        bindGlobalMenuClose()

        document.getElementById('wvCopy')?.addEventListener('click', async () => {
            const params = state.wvContextParams || {}
            if (params.mediaType === 'image' && params.srcURL) {
                // Скачиваем картинку через preload → копируем через main process clipboard
                const wv = getActiveWebview()
                if (wv) {
                    state._wvCopyMode = true
                    wv.send('download-image', params.srcURL)
                }
            } else if (params.selectionText) {
                // Копируем выделенный текст
                try {
                    await navigator.clipboard.writeText(params.selectionText)
                } catch {
                    // fallback если clipboard API недоступен
                    invokeIpc('copy-text-to-clipboard', params.selectionText).catch(() => {})
                }
            }
            hideWebviewContextMenu()
        })

        document.getElementById('wvSavePage')?.addEventListener('click', () => {
            ipcRenderer.send('save-page')
            hideWebviewContextMenu()
        })

        document.getElementById('wvSaveImage')?.addEventListener('click', async () => {
            hideWebviewContextMenu()
            if (!state.wvContextParams.srcURL) return

            const wv = getActiveWebview()
            if (!wv) return

            const result = await invokeIpc('get-save-image-path', state.wvContextParams.srcURL)
            if (!result.success) return

            const filePath = result.data
            if (!filePath) return

            state.wvContextParams._filePath = filePath
            wv.send('download-image', state.wvContextParams.srcURL)
        })

        document.getElementById('wvZoomIn')?.addEventListener('click', () => {
            applyTabZoom(state.tabZoomLevel + 0.25)
            hideWebviewContextMenu()
        })

        document.getElementById('wvZoomOut')?.addEventListener('click', () => {
            applyTabZoom(state.tabZoomLevel - 0.25)
            hideWebviewContextMenu()
        })

        document.getElementById('wvZoomReset')?.addEventListener('click', () => {
            applyTabZoom(1.0)
            hideWebviewContextMenu()
        })

        document.getElementById('wvFind')?.addEventListener('click', () => {
            openFindBar()
            hideWebviewContextMenu()
        })

        document.getElementById('wvPrint')?.addEventListener('click', () => {
            getActiveWebview()?.print()
            hideWebviewContextMenu()
        })
    }

    return {
        addTab,
        attachFindListener,
        attachContextMenu,
        addWebview,
        bindWebviewContextMenuActions
    }
}

module.exports = {
    createWebviewTabsApi
}