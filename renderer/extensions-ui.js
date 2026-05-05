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
        id: 'hdokiejnpimakedhajhdlcegeplioahd',
        name: 'LastPass',
        desc: 'Менеджер паролей — автозаполнение форм',
        category: 'Безопасность',
        color: '#CC0000',
        icon: 'https://www.google.com/s2/favicons?domain=lastpass.com&sz=64'
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
        desc: 'Проверка орфографии и грамматики',
        category: 'Инструменты',
        color: '#15C39A',
        icon: 'https://www.google.com/s2/favicons?domain=grammarly.com&sz=64'
    },
    {
        id: 'aapbdbdomjkkjkaonfhkkikfgjllcleb',
        name: 'Google Переводчик',
        desc: 'Перевод страниц одним кликом',
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
        id: 'bmnlcjabgnpnenekpadlanbbkooimhnj',
        name: 'Honey',
        desc: 'Автоматический поиск купонов при покупках',
        category: 'Покупки',
        color: '#FFA500',
        icon: 'https://www.google.com/s2/favicons?domain=joinhoney.com&sz=64'
    }
]

function createExtensionsUiApi({ invokeIpc, tGet, requirePro }) {
    let installedIds = new Set()
    let disabledIds  = new Set()
    let busyIds      = new Set()

    async function refreshInstalled() {
        const res = await invokeIpc('ext:list')
        if (!res?.success) return
        installedIds = new Set(res.data.map(e => e.id))
        disabledIds  = new Set(res.data.filter(e => !e.enabled).map(e => e.id))
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
                if (!confirm(`Удалить ${ext.name}?`)) return
                busyIds.add(ext.id)
                await invokeIpc('ext:uninstall', ext.id)
                installedIds.delete(ext.id)
                busyIds.delete(ext.id)
                renderAll(container)
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
            section.innerHTML = `<div class="ext-category-title">${cat}</div>`
            const grid = document.createElement('div')
            grid.className = 'ext-grid'
            items.forEach(ext => grid.appendChild(renderCard(ext, container)))
            section.appendChild(grid)
            container.appendChild(section)
        }
    }

    async function openExtensionsSection() {
        await refreshInstalled()
        const container = document.getElementById('extensionsCatalog')
        renderAll(container)
    }

    return { openExtensionsSection }
}

module.exports = { createExtensionsUiApi, EXTENSION_CATALOG: CATALOG }
