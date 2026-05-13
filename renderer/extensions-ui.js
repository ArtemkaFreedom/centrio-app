// Расширения отмечены: работают ли popup/функции в Electron.
// ✅ content-script only — работают (Dark Reader, uBlock, AdBlock)
// ⚠️ popup + chrome.tabs — работает частично (Grammarly, переводчики)
// ❌ требуют реальных браузерных вкладок — убраны из каталога
const CATALOG = [
    {
        id: 'gighmmpiobklfepjocnamgkkbiglidom',
        name: 'AdBlock',
        desc: 'Блокировщик рекламы и всплывающих окон',
        category: 'Безопасность',
        color: '#F8321E',
        icon: 'https://www.google.com/s2/favicons?domain=getadblock.com&sz=64'
    },
    {
        id: 'kbfnbcaeplbcioakkpcpgfkobkghlhen',
        name: 'Grammarly',
        desc: 'Проверка орфографии и грамматики на английском',
        category: 'Инструменты',
        color: '#15C39A',
        icon: 'https://www.google.com/s2/favicons?domain=grammarly.com&sz=64'
    },
    {
        id: 'aapbdbdomjkkjkaonfhkkikfgjllcleb',
        name: 'Google Переводчик',
        desc: 'Перевод выделенного текста на страницах',
        category: 'Инструменты',
        color: '#4285F4',
        icon: 'https://www.google.com/s2/favicons?domain=translate.google.com&sz=64'
    },
]

function createExtensionsUiApi({ invokeIpc, tGet, requirePro, getActivePartition, getActiveTabUrl }) {
    let installedIds   = new Set()
    let disabledIds    = new Set()

    // Открыть попап расширения нативно: вызываем window.open() прямо внутри
    // активного webview (renderer-initiated), чтобы Electron создал окно через
    // setWindowOpenHandler({action:'allow'}) и обошёл ExtensionNavigationThrottle.
    function openExtPopupNative(url) {
        if (!url) return
        // Webview-shell обход: главное окно грузит data:HTML с <webview src="chrome-extension://...">
        // — webview guest navigations не блокируются ExtensionNavigationThrottle.
        const partition = (typeof getActivePartition === 'function' && getActivePartition()) || 'persist:ext-popup'
        invokeIpc('open-popup-window', url, { width: 400, height: 600, partition }).catch(() => {})
    }
    let busyIds        = new Set()
    let extMetaMap     = new Map()

    async function refreshInstalled() {
        const res = await invokeIpc('ext:list')
        if (!res?.success) return
        installedIds = new Set(res.data.map(e => e.id))
        disabledIds  = new Set(res.data.filter(e => !e.enabled).map(e => e.id))
        extMetaMap   = new Map(res.data.map(e => [e.id, e]))
    }

    function renderCard(ext, container) {
        const installed = installedIds.has(ext.id)
        const enabled   = installed && !disabledIds.has(ext.id)
        const busy      = busyIds.has(ext.id)

        const card = document.createElement('div')
        card.className = 'ext-card' + (installed ? ' ext-installed' : '')
        card.dataset.id = ext.id
        card.innerHTML = `
            <div class="ext-card-icon" style="background:${ext.color}20; border-color:${ext.color}40">
                <img src="${ext.icon}" width="32" height="32" onerror="this.style.display='none'">
            </div>
            <div class="ext-card-info">
                <div class="ext-card-name">${ext.name}</div>
                <div class="ext-card-desc">${ext.desc}</div>
                <div class="ext-card-cat">${ext.category}</div>
            </div>
            <div class="ext-card-actions">
                ${installed ? `
                    ${(extMetaMap.get(ext.id)?.optionsPage) ? `
                        <button class="ext-settings-btn" data-id="${ext.id}" title="${tGet('extensions.openSettings') || 'Настройки'}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </button>
                    ` : ''}
                    <label class="ext-toggle">
                        <input type="checkbox" class="ext-toggle-check" ${enabled ? 'checked' : ''}>
                        <span class="ext-toggle-slider"></span>
                    </label>
                    <button class="ext-uninstall-btn" title="Удалить">✕</button>
                ` : `
                    <button class="ext-install-btn ${busy ? 'loading' : ''}" ${busy ? 'disabled' : ''}>
                        ${busy ? '⏳' : '+ Установить'}
                    </button>
                `}
            </div>
        `

        if (installed) {
            const sBtn = card.querySelector('.ext-settings-btn')
            if (sBtn) {
                sBtn.onclick = (e) => {
                    e.stopPropagation()
                    const meta = extMetaMap.get(ext.id)
                    if (meta?.optionsPage) openExtPopupNative(meta.optionsPage)
                }
            }

            const toggle = card.querySelector('.ext-toggle-check')
            toggle?.addEventListener('change', async (e) => {
                await invokeIpc('ext:toggle', ext.id, e.target.checked)
                if (e.target.checked) disabledIds.delete(ext.id)
                else disabledIds.add(ext.id)
            })

            const uninstallBtn = card.querySelector('.ext-uninstall-btn')
            uninstallBtn?.addEventListener('click', async () => {
                let confirmed = false
                if (typeof window.showConfirmModal === 'function') {
                    confirmed = await window.showConfirmModal({
                        title: tGet('extensions.uninstallTitle') || `Удалить ${ext.name}?`,
                        message: tGet('extensions.uninstallMsg') || 'Расширение будет удалено. Это действие необратимо.',
                        confirmText: tGet('extensions.uninstallBtn') || 'Удалить',
                        cancelText: tGet('dialogs.cancel') || 'Отмена',
                        danger: true
                    })
                } else {
                    confirmed = confirm(`Удалить ${ext.name}?`)
                }
                if (!confirmed) return
                busyIds.add(ext.id)
                await invokeIpc('ext:uninstall', ext.id)
                installedIds.delete(ext.id)
                extMetaMap.delete(ext.id)
                busyIds.delete(ext.id)
                renderAll(container)
                renderExtBar()
            })

            card.addEventListener('contextmenu', (e) => {
                e.preventDefault()
                e.stopPropagation()
                showExtContextMenu(e.clientX, e.clientY, ext.id)
            })
        } else {
            const installBtn = card.querySelector('.ext-install-btn')
            installBtn?.addEventListener('click', async () => {
                if (!requirePro('extensions')) return
                busyIds.add(ext.id)
                renderAll(container)
                const res = await invokeIpc('ext:install', ext.id)
                busyIds.delete(ext.id)
                if (res?.success) {
                    installedIds.add(ext.id)
                    await refreshInstalled()
                    renderExtBar()
                } else {
                    alert(`Ошибка установки: ${res?.error || 'неизвестно'}`)
                }
                renderAll(container)
            })
        }

        return card
    }

    function renderAll(container) {
        if (!container) return
        container.innerHTML = ''

        const categories = [...new Set(CATALOG.map(e => e.category))]
        for (const cat of categories) {
            const items = CATALOG.filter(e => e.category === cat)
            const section = document.createElement('div')
            section.className = 'ext-category'
            let catHeader = `<div class="ext-category-title">${cat}`
            if (cat === 'VPN и прокси') {
                catHeader += ` <span class="ext-cat-badge ext-cat-pro" title="VPN — только PRO">VPN: PRO</span>`
                catHeader += ` <span class="ext-cat-badge ext-cat-free" title="Прокси — бесплатно">Прокси: Free</span>`
            }
            catHeader += `</div>`
            section.innerHTML = catHeader
            const grid = document.createElement('div')
            grid.className = 'ext-grid'
            items.forEach(ext => grid.appendChild(renderCard(ext, container)))
            section.appendChild(grid)
            container.appendChild(section)
        }
    }

    function getOrCreateContextMenu() {
        let menu = document.getElementById('extContextMenu')
        if (!menu) {
            menu = document.createElement('div')
            menu.id = 'extContextMenu'
            menu.className = 'ext-ctx-menu'
            document.body.appendChild(menu)
            document.addEventListener('click', () => menu.classList.remove('show'), true)
        }
        return menu
    }

    function showExtContextMenu(x, y, extId) {
        const meta = extMetaMap.get(extId)
        if (!meta) return
        const menu = getOrCreateContextMenu()

        const items = []
        if (meta.popupPage) {
            items.push({ label: tGet('extensions.openPopup') || 'Открыть попап', url: meta.popupPage })
        }
        if (meta.optionsPage) {
            items.push({ label: tGet('extensions.openSettings') || 'Настройки расширения', url: meta.optionsPage })
        }
        if (!items.length) {
            items.push({ label: tGet('extensions.noPages') || 'Нет страниц расширения', disabled: true })
        }

        menu.innerHTML = items.map(item =>
            item.disabled
                ? `<div class="ext-ctx-item ext-ctx-disabled">${item.label}</div>`
                : `<div class="ext-ctx-item" data-url="${item.url}">${item.label}</div>`
        ).join('')

        menu.querySelectorAll('.ext-ctx-item[data-url]').forEach(el => {
            el.addEventListener('click', () => {
                openExtPopupNative(el.dataset.url)
                menu.classList.remove('show')
            })
        })

        const vw = window.innerWidth, vh = window.innerHeight
        const mw = 220, mh = items.length * 36 + 8
        menu.style.left = (x + mw > vw ? x - mw : x) + 'px'
        menu.style.top  = (y + mh > vh ? y - mh : y) + 'px'
        menu.classList.add('show')
    }

    // ── Status-bar icons: убраны, иконки переехали в сайдбар (appsBtn) ────────
    function renderExtBar() {
        // Скрываем статус-бар иконки расширений
        const bar = document.getElementById('statusExtIcons')
        const sep = document.getElementById('statusExtSep')
        if (bar) bar.style.display = 'none'
        if (sep) sep.style.display = 'none'
        // Обновляем submenu в webview context menu
        _populateExtContextSubmenu()
        // Обновляем popover если открыт
        _renderAppsPopoverList()
    }

    // ── Apps popover in sidebar ───────────────────────────────────────────────
    function _renderAppsPopoverList() {
        const listEl = document.getElementById('appsPopoverList')
        if (!listEl) return

        const installed = [...installedIds].filter(id => !disabledIds.has(id))
        listEl.innerHTML = ''

        if (!installed.length) {
            listEl.innerHTML = '<div style="padding:8px 14px;font-size:12px;color:var(--text-muted);">Нет установленных расширений</div>'
            return
        }

        installed.forEach(id => {
            const meta = extMetaMap.get(id)
            const catEntry = CATALOG.find(e => e.id === id)
            const iconUrl = catEntry?.icon || `https://www.google.com/s2/favicons?domain=${id}&sz=32`
            const name = meta?.name || catEntry?.name || id

            const item = document.createElement('div')
            item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:var(--radius);cursor:pointer;transition:background .15s;'
            item.onmouseenter = () => { item.style.background = 'var(--bg-hover)' }
            item.onmouseleave = () => { item.style.background = '' }

            const img = document.createElement('img')
            img.src = iconUrl
            img.alt = name
            img.style.cssText = 'width:20px;height:20px;border-radius:4px;flex-shrink:0;'
            img.onerror = function () {
                this.style.display = 'none'
                const l = document.createElement('div')
                l.style.cssText = 'width:20px;height:20px;border-radius:4px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;'
                l.textContent = name[0]?.toUpperCase() || '?'
                item.insertBefore(l, item.firstChild)
            }

            const label = document.createElement('span')
            label.style.cssText = 'font-size:13px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
            label.textContent = name

            item.appendChild(img)
            item.appendChild(label)

            // Контейнер для кнопок действий
            const actions = document.createElement('div')
            actions.style.cssText = 'display:flex;align-items:center;gap:4px;flex-shrink:0;'

            // Кнопка открытия настроек (если есть)
            if (meta?.optionsPage) {
                const sBtn = document.createElement('div')
                sBtn.className = 'apps-popover-action-btn'
                sBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
                sBtn.title = tGet('extensions.openSettings') || 'Настройки расширения'
                sBtn.onclick = (e) => {
                    e.stopPropagation()
                    closeAppsPopover()
                    openExtPopupNative(meta.optionsPage)
                }
                actions.appendChild(sBtn)
            }

            item.appendChild(actions)

            item.addEventListener('click', () => {
                closeAppsPopover()
                if (meta?.popupPage) {
                    openExtPopupNative(meta.popupPage)
                } else if (meta?.optionsPage) {
                    openExtPopupNative(meta.optionsPage)
                } else {
                    const rect = document.getElementById('appsBtn')?.getBoundingClientRect() || {}
                    showExtContextMenu((rect.right || 60) + 4, rect.top || 100, id)
                }
            })

            listEl.appendChild(item)
        })
    }

    function closeAppsPopover() {
        const pop = document.getElementById('appsPopover')
        if (pop) pop.style.display = 'none'
    }

    function initAppsBtn({ openSettingsSection }) {
        const btn = document.getElementById('appsBtn')
        const pop = document.getElementById('appsPopover')
        if (!btn || !pop) return

        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const isOpen = pop.style.display === 'flex'
            if (isOpen) {
                pop.style.display = 'none'
                return
            }
            // Позиционируем popover над кнопкой
            const rect = btn.getBoundingClientRect()
            pop.style.bottom = (window.innerHeight - rect.bottom + rect.height + 4) + 'px'
            pop.style.left = (rect.right + 4) + 'px'
            pop.style.display = 'flex'
            _renderAppsPopoverList()
        })

        // Закрываем при клике вне
        document.addEventListener('click', (e) => {
            if (!pop.contains(e.target) && e.target !== btn) {
                pop.style.display = 'none'
            }
        })

        // Кнопка "Установить расширения"
        const installBtn = document.getElementById('appsPopoverInstallBtn')
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                closeAppsPopover()
                if (typeof openSettingsSection === 'function') openSettingsSection('extensions')
            })
        }
    }

    function _populateExtContextSubmenu() {
        // Расширения убраны из контекстного меню вебью — пользователь
        // открывает их через кнопку приложений в сайдбаре.
        const extItem    = document.getElementById('wvExtensions')
        const extDivider = document.getElementById('wvExtDivider')
        if (extItem)    extItem.style.display    = 'none'
        if (extDivider) extDivider.style.display = 'none'
    }

    async function openExtensionsSection() {
        await refreshInstalled()
        const container = document.getElementById('extensionsCatalog')
        renderAll(container)
        renderExtBar()
    }

    function getExtInfo(id) {
        const meta = extMetaMap.get(id)
        const catEntry = CATALOG.find(e => e.id === id)
        if (!meta && !catEntry) return null
        return {
            id,
            name: meta?.name || catEntry?.name || id,
            icon: catEntry?.icon || null,
            popupPage: meta?.popupPage || null,
            optionsPage: meta?.optionsPage || null,
        }
    }

    return { openExtensionsSection, renderExtBar, refreshInstalled, getExtInfo, initAppsBtn }
}

module.exports = { createExtensionsUiApi, EXTENSION_CATALOG: CATALOG }
