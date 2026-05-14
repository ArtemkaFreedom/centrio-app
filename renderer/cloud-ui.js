function createCloudUiApi({
    cloudStore,
    tGet,
    getUserInitial,
    getLocalStats   // () => { messengers, folders, lastSyncAt }
}) {
    const PRO_PLANS = new Set(['PRO', 'PRO_YEAR', 'TEAM'])

    function _isPro(user) {
        return PRO_PLANS.has((user?.plan || '').toUpperCase())
    }

    // ── Sidebar cloudBtn ──────────────────────────────────────────
    function updateCloudBtn() {
        const btn = document.getElementById('cloudBtn')
        if (!btn) return

        const user = cloudStore.getUser()
        if (!user) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/>
            </svg>`
            btn.title = tGet('cloud.accountBtn')
            return
        }

        const pro   = _isPro(user)
        const size  = pro ? 26 : 26  // inner avatar size
        const inner = user.avatar
            ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">`
            : `<div style="width:100%;height:100%;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;">${getUserInitial(user)}</div>`

        if (pro) {
            btn.innerHTML = `
                <div class="sidebar-avatar-ring is-pro" style="width:30px;height:30px;">
                    <div class="sidebar-avatar-inner" style="width:${size}px;height:${size}px;">${inner}</div>
                </div>`
        } else {
            btn.innerHTML = `
                <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;">${inner}</div>`
        }
        btn.title = user.name
    }

    // ── Аватарка в модале ─────────────────────────────────────────
    function updateAvatarInModal(src) {
        const avatarEl = document.getElementById('cloudUserAvatar')
        const overlay  = document.getElementById('cloudAvatarOverlay')
        if (!avatarEl || !overlay) return

        if (src) {
            avatarEl.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            avatarEl.appendChild(overlay)
        } else {
            const user = cloudStore.getUser()
            avatarEl.innerHTML = getUserInitial(user)
            avatarEl.appendChild(overlay)
        }
    }

    // ── PRO-кольцо в модале ──────────────────────────────────────
    function _applyProRing(isPro) {
        const ring = document.getElementById('cloudAvatarRing')
        if (!ring) return
        ring.classList.toggle('is-pro', isPro)
    }

    // ── Бейдж плана ──────────────────────────────────────────────
    function _applyPlanBadge(plan) {
        const el = document.getElementById('cloudUserPlan')
        if (!el) return
        el.textContent = plan
        el.classList.toggle('is-pro', PRO_PLANS.has(plan))
    }

    // ── Подсветка текущего тарифа ─────────────────────────────────
    function _updatePlanCards(plan) {
        const planNorm = plan.toUpperCase()
        ;['FREE', 'PRO', 'PRO_YEAR'].forEach(p => {
            const idMap = { FREE: 'planCardFree', PRO: 'planCardPro', PRO_YEAR: 'planCardProYear' }
            const el = document.getElementById(idMap[p])
            if (el) el.classList.toggle('is-current', planNorm === p)
        })
    }

    // ── Форматирование даты синхронизации ─────────────────────────
    function _formatSyncDate(iso) {
        if (!iso) return '—'
        try {
            const d    = new Date(iso)
            const now  = new Date()
            const diff = now - d
            if (diff < 60_000) {
                return tGet('cloud.syncJustNow') || '< 1 min ago'
            }
            if (diff < 3_600_000) {
                const mins = Math.floor(diff / 60_000)
                const tpl  = tGet('cloud.syncMinAgo') || '{n} min ago'
                return tpl.replace('{n}', mins)
            }
            const isToday = d.toDateString() === now.toDateString()
            if (isToday) {
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
        } catch {
            return '—'
        }
    }

    // ── Локальная статистика ──────────────────────────────────────
    function _renderLocalStats() {
        const stats = getLocalStats ? getLocalStats() : {}

        const msgEl  = document.getElementById('statMessengers')
        const fldEl  = document.getElementById('statFolders')
        const syncEl = document.getElementById('statLastSync')

        if (msgEl)  msgEl.textContent  = stats.messengers ?? '—'
        if (fldEl)  fldEl.textContent  = stats.folders    ?? '—'
        if (syncEl) syncEl.textContent = _formatSyncDate(stats.lastSyncAt)
    }

    // ── Открыть вид входа ─────────────────────────────────────────
    function openCloudLogin() {
        const modal = document.getElementById('cloudModal')
        if (!modal) return

        const content = modal.querySelector('.cloud-modal-content')
        if (content) content.classList.remove('profile-open')

        modal.classList.add('show')
        document.getElementById('cloudLoginView').style.display  = 'flex'
        document.getElementById('cloudProfileView').style.display = 'none'
        document.getElementById('cloudLoginError').style.display  = 'none'
        document.getElementById('cloudEmail').value    = ''
        document.getElementById('cloudPassword').value = ''
    }

    // ── Открыть профиль ───────────────────────────────────────────
    function openCloudProfile() {
        const user  = cloudStore.getUser()
        const modal = document.getElementById('cloudModal')
        if (!modal) return

        const content = modal.querySelector('.cloud-modal-content')
        if (content) content.classList.add('profile-open')

        modal.classList.add('show')
        document.getElementById('cloudLoginView').style.display   = 'none'
        document.getElementById('cloudProfileView').style.display = 'flex'

        document.getElementById('cloudUserName').textContent  = user?.name  || ''
        document.getElementById('cloudUserEmail').textContent = user?.email || ''

        const plan = (user?.plan || 'FREE').toUpperCase()
        _applyPlanBadge(plan)
        _applyProRing(_isPro(user))
        updateAvatarInModal(user?.avatar || null)

        document.getElementById('cloudEditNameWrap').style.display = 'none'
        document.getElementById('cloudEditNameBtn').style.display  = 'flex'

        _updatePlanCards(plan)
        _renderLocalStats()
    }

    return {
        updateCloudBtn,
        updateAvatarInModal,
        openCloudLogin,
        openCloudProfile,
        renderLocalStats: _renderLocalStats
    }
}

module.exports = { createCloudUiApi }
