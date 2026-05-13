function createSearchUiApi({
    state,
    quickSearch,
    quickSearchInput,
    quickSearchResults,
    findBar,
    findInput,
    findCount,
    tGet,
    switchTab,
    isMessengerMuted
}) {
    function openFindBar() {
        findBar.classList.add('show')
        findInput.value = ''
        findCount.textContent = ''
        setTimeout(() => findInput.focus(), 50)
    }

    function closeFindBar() {
        findBar.classList.remove('show')
        stopFind()
    }

    function doFind(forward = true) {
        if (!state.activeTabId) return
        const webview = document.getElementById(`webview-${state.activeTabId}`)
        if (!webview || !findInput.value) return
        webview.findInPage(findInput.value, { forward, findNext: true })
    }

    function stopFind() {
        if (!state.activeTabId) return
        const webview = document.getElementById(`webview-${state.activeTabId}`)
        if (webview) webview.stopFindInPage('clearSelection')
        findCount.textContent = ''
    }

    function openQuickSearch() {
        quickSearch.classList.add('show')
        quickSearchInput.value = ''
        renderQuickSearchResults('')
        setTimeout(() => quickSearchInput.focus(), 50)
    }

    function closeQuickSearch() {
        quickSearch.classList.remove('show')
    }

    function renderQuickSearchResults(query) {
        const q = query.toLowerCase().trim()

        // 1. Filter messengers
        const filteredMsgs = q
            ? state.activeMessengers.filter(m => m.name.toLowerCase().includes(q))
            : state.activeMessengers

        // 2. Filter extensions
        const { EXTENSION_CATALOG } = require('./extensions-ui')
        const filteredExts = q
            ? (EXTENSION_CATALOG || []).filter(e => e.name.toLowerCase().includes(q))
            : []

        quickSearchResults.innerHTML = ''
        if (filtered.length === 0) {
            quickSearchResults.innerHTML = `<div class="quick-search-empty">${tGet('search.empty')}</div>`
            return
        }

        // Render Messengers
        filteredMsgs.forEach((m, idx) => {
            const hostname = (() => {
                try { return new URL(m.url).hostname } catch { return '' }
            })()

            const item = document.createElement('div')
            item.className = 'quick-search-item' + (idx === 0 ? ' selected' : '')
            const nameHtml = q ? m.name.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>') : m.name
            const unread = state.unreadCounts[m.id] || 0
            const muted = isMessengerMuted(m.id)

            item.innerHTML = `
                <img src="https://www.google.com/s2/favicons?domain=${hostname}&sz=32"
                     onerror="this.style.display='none'" width="24" height="24" style="border-radius:6px;">
                <span class="quick-search-item-name">${nameHtml}</span>
                ${muted ? `<span class="quick-search-item-muted" title="${tGet('notifications.muteIcon')}">🔕</span>` : ''}
                ${unread > 0 ? `<span class="quick-search-item-badge">${unread}</span>` : ''}
            `

            item.addEventListener('click', () => {
                switchTab(m.id)
                closeQuickSearch()
            })

            quickSearchResults.appendChild(item)
        })

        // Render Extensions
        if (filteredExts.length > 0) {
            const header = document.createElement('div')
            header.style.cssText = 'padding:10px 12px 4px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;'
            header.textContent = tGet('settings.sections.extensions') || 'Расширения'
            quickSearchResults.appendChild(header)

            filteredExts.forEach(e => {
                const item = document.createElement('div')
                item.className = 'quick-search-item'
                const nameHtml = q ? e.name.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>') : e.name

                item.innerHTML = `
                    <img src="${e.icon}" onerror="this.style.display='none'" width="24" height="24" style="border-radius:6px;">
                    <span class="quick-search-item-name">${nameHtml}</span>
                `

                item.addEventListener('click', () => {
                    closeQuickSearch()
                    document.getElementById('settingsBtn')?.click()
                    setTimeout(() => {
                        document.querySelector('.settings-nav-item[data-section="extensions"]')?.click()
                    }, 150)
                })

                quickSearchResults.appendChild(item)
            })
        }
    }

    function bind() {
        findInput.addEventListener('input', () => {
            if (!findInput.value) {
                stopFind()
                return
            }

            if (!state.activeTabId) return
            document.getElementById(`webview-${state.activeTabId}`)?.findInPage(findInput.value)
        })

        findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.shiftKey ? doFind(false) : doFind(true)
            if (e.key === 'Escape') closeFindBar()
        })

        document.getElementById('findNext').addEventListener('click', () => doFind(true))
        document.getElementById('findPrev').addEventListener('click', () => doFind(false))
        document.getElementById('findClose').addEventListener('click', () => closeFindBar())

        quickSearchInput.addEventListener('input', (e) => renderQuickSearchResults(e.target.value))
        quickSearchInput.addEventListener('keydown', (e) => {
            const items = quickSearchResults.querySelectorAll('.quick-search-item')
            const selected = quickSearchResults.querySelector('.quick-search-item.selected')
            const idx = Array.from(items).indexOf(selected)

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (idx < items.length - 1) {
                    selected?.classList.remove('selected')
                    items[idx + 1].classList.add('selected')
                    items[idx + 1].scrollIntoView({ block: 'nearest' })
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                if (idx > 0) {
                    selected?.classList.remove('selected')
                    items[idx - 1].classList.add('selected')
                    items[idx - 1].scrollIntoView({ block: 'nearest' })
                }
            } else if (e.key === 'Enter') {
                e.preventDefault()
                selected?.click()
            } else if (e.key === 'Escape') {
                closeQuickSearch()
            }
        })

        quickSearch.addEventListener('click', (e) => {
            if (e.target === quickSearch) closeQuickSearch()
        })
    }

    return {
        openFindBar,
        closeFindBar,
        doFind,
        stopFind,
        openQuickSearch,
        closeQuickSearch,
        renderQuickSearchResults,
        bind
    }
}

module.exports = {
    createSearchUiApi
}