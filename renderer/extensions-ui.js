// Расширения отмечены: работают ли popup/функции в Electron.
// ✅ content-script only — работают (Dark Reader, uBlock, AdBlock)
// ⚠️ popup + chrome.tabs — работает частично (Grammarly, переводчики)
// ❌ требуют реальных браузерных вкладок — убраны из каталога
const CATALOG = [
    {
        id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
        name: 'uBlock Origin',
        desc: 'Лучший блокировщик рекламы и трекеров',
        category: 'Безопасность',
        color: '#800000',
        icon: 'https://www.google.com/s2/favicons?domain=ublockorigin.com&sz=64'
    },
    {
        id: 'nngceckbapebfimnlniiiahkandclblb',
        name: 'Bitwarden',
        desc: 'Бесплатный менеджер паролей с открытым кодом',
        category: 'Безопасность',
        color: '#175DDC',
        icon: 'https://www.google.com/s2/favicons?domain=bitwarden.com&sz=64'
    },
    {
        id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
        name: 'Dark Reader',
        desc: 'Тёмная тема для любого сайта',
        category: 'Внешний вид',
        color: '#1A1A2E',
        icon: 'https://www.google.com/s2/favicons?domain=darkreader.org&sz=64'
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
    {
        id: 'gighmmpiobklfepjocnamgkkbiglidom',
        name: 'AdBlock',
        desc: 'Блокировщик рекламы и всплывающих окон',
        category: 'Безопасность',
        color: '#F8321E',
        icon: 'https://www.google.com/s2/favicons?domain=getadblock.com&sz=64'
    },
    {
        id: 'oldceeleldhonbafppcapldpdifcinji',
        name: 'LanguageTool',
        desc: 'Проверка орфографии и грамматики на 25+ языках',
        category: 'Инструменты',
        color: '#0070C0',
        icon: 'https://www.google.com/s2/favicons?domain=languagetool.org&sz=64'
    },
    {
        id: 'bmnlcjabgnpnenekpadlanbbkooimhnj',
        name: 'Honey',
        desc: 'Автоматический поиск и применение промокодов',
        category: 'Покупки',
        color: '#F5A623',
        icon: 'https://www.google.com/s2/favicons?domain=joinhoney.com&sz=64'
    },
    {
        id: 'knheggckgoiihginacbkhaalnibhilkk',
        name: 'Notion Web Clipper',
        desc: 'Сохранение веб-страниц в Notion одним кликом',
        category: 'Продуктивность',
        color: '#000000',
        icon: 'https://www.google.com/s2/favicons?domain=notion.so&sz=64'
    },
    {
        id: 'niloccemoadcdkdjlinkgdfekeahmflj',
        name: 'Save to Pocket',
        desc: 'Сохранение статей и видео для чтения позже',
        category: 'Продуктивность',
        color: '#EF4056',
        icon: 'https://www.google.com/s2/favicons?domain=getpocket.com&sz=64'
    },
    {
        id: 'dbepggeogbaibhgnhhndojpepiihcmeb',
        name: 'Vimium',
        desc: 'Управление браузером с клавиатуры в стиле Vim',
        category: 'Продуктивность',
        color: '#3D3D3D',
        icon: 'https://www.google.com/s2/favicons?domain=vimium.github.io&sz=64'
    },
    {
        id: 'bhlhnicpbhignbdhedgjhgdocnmhomnp',
        name: 'ColorZilla',
        desc: 'Пипетка цвета и анализатор палитры страницы',
        category: 'Дизайн',
        color: '#E4002B',
        icon: 'https://www.google.com/s2/favicons?domain=colorzilla.com&sz=64'
    },
    {
        id: 'gbmdgpbipfallnflgajpaliibnhdgobh',
        name: 'JSON Viewer',
        desc: 'Красивый просмотр JSON-страниц с подсветкой',
        category: 'Разработка',
        color: '#009688',
        icon: 'https://www.google.com/s2/favicons?domain=tulios.github.io&sz=64'
    },
    {
        id: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp',
        name: 'Privacy Badger',
        desc: 'Автоматическая защита от трекеров от EFF',
        category: 'Безопасность',
        color: '#EF8E1D',
        icon: 'https://www.google.com/s2/favicons?domain=privacybadger.org&sz=64'
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

            item.addEventListener('click', () => {
                closeAppsPopover()
                if (meta?.popupPage) {
                    openExtPopupNative(meta.popupPage)
                } else {
                    // Открываем контекст меню расширения
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
