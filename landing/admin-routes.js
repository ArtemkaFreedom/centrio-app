const router = require('express').Router()
const prisma  = require('../utils/prisma')
const { getQrDataUrl, verifyTotp, checkSession } = require('../utils/admin-otp')
const { sendEmail } = require('../lib/email')

// ── Открытые маршруты (без auth) ──────────────────────────────────────────────

// GET /api/admin/setup-qr  — QR-код для первичной настройки
// Защищён отдельным ключом SETUP_KEY из .env — знаете только вы
router.get('/setup-qr', async (req, res) => {
    // Отключено (security fix): первичная настройка TOTP админки уже
    // завершена и активно используется (POST /verify-totp работает и
    // требует валидный TOTP-код уже сейчас). Этот маршрут ранее отдавал
    // сырой TOTP_SECRET в открытом JSON тому, кто знает SETUP_KEY, а
    // сравнение SETUP_KEY было не timing-safe (`!==`). Маршрут оставлен
    // (не удалён), чтобы не сломать ничего, что могло на него ссылаться,
    // но теперь безусловно возвращает 410.
    return res.status(410).json({ error: 'Endpoint disabled' })
})

// POST /api/admin/verify-totp  — проверить код, получить сессию
// Rate limiting/lockout по IP реализован в admin-otp.js (verifyTotp) —
// защита от брутфорса 6-значного TOTP-кода.
router.post('/verify-totp', (req, res) => {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Код не передан' })
    const clientKey = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    const result = verifyTotp(code, clientKey)
    if (!result.ok) {
        const status = result.locked ? 429 : 401
        if (result.locked && result.retryAfterSec) res.set('Retry-After', String(result.retryAfterSec))
        return res.status(status).json({ error: result.error })
    }
    res.json({ ok: true, token: result.token })
})

// ── Middleware: сессионный токен ──────────────────────────────────────────────
function adminAuth(req, res, next) {
    const token = req.headers['x-admin-token']
    if (!checkSession(token)) {
        return res.status(403).json({ error: 'Сессия истекла — войдите заново', code: 'SESSION_EXPIRED' })
    }
    next()
}

router.use(adminAuth)

// ── Best-effort audit log ──────────────────────────────────────────
// A real, queryable DB-backed audit log needs a new Prisma model
// (AdminAuditLog) added to schema.prisma on the server — that requires
// direct server access this session didn't have (SSH password auth is
// disabled; only key-based access works, see centrio-hardening.plan.md).
// Structured console logging is the safe interim step: every mutating
// admin action below is captured in pm2 logs with actor IP + target,
// queryable via `pm2 logs centrio-api | grep AUDIT` until the real table
// lands. There's only a single shared TOTP admin identity right now (no
// per-admin accounts), so there's no "who" beyond "the admin" — IP is the
// closest available signal.
function audit(req, action, target) {
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown'
    console.log(`[AUDIT] action=${action} target=${JSON.stringify(target)} ip=${ip} at=${new Date().toISOString()}`)
}

// ── Определить метод входа ────────────────────────────────────────────────────
function detectProvider(user) {
    if (user.googleId)     return 'Google'
    if (user.yandexId)     return 'Яндекс'
    if (user.githubId)     return 'GitHub'
    if (user.telegramId)   return 'Telegram'
    if (user.vkId)         return 'VK'
    if (user.mailId)       return 'Mail.ru'
    if (user.passwordHash) return 'Email'
    return '—'
}

function isOnline(lastSeenAt) {
    if (!lastSeenAt) return false
    return (Date.now() - new Date(lastSeenAt).getTime()) < 5 * 60 * 1000
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
const USER_SELECT = {
    id: true, email: true, name: true, avatar: true,
    plan: true, planExpiresAt: true, isActive: true, isAdmin: true,
    lastSeenAt: true, createdAt: true, autoRenew: true,
    googleId: true, yandexId: true, githubId: true,
    telegramId: true, vkId: true, mailId: true, passwordHash: true,
    _count: { select: { messengers: true, folders: true, sessions: true } }
}

function mapUserRow(u) {
    return {
        id: u.id, email: u.email, name: u.name, avatar: u.avatar,
        plan: u.plan, planExpiresAt: u.planExpiresAt,
        isActive: u.isActive, isAdmin: u.isAdmin,
        lastSeenAt: u.lastSeenAt, createdAt: u.createdAt,
        autoRenew:  u.autoRenew || false,
        hasPassword: !!u.passwordHash,
        online:     isOnline(u.lastSeenAt),
        provider:   detectProvider(u),
        messengers: u._count.messengers,
        folders:    u._count.folders,
        sessions:   u._count.sessions
    }
}

// Пустая строка/отсутствие параметра → нет фильтра; иначе — валидное неотрицательное целое.
function parseCountParam(value) {
    if (value === undefined || value === null || value === '') return null
    const n = parseInt(value, 10)
    return Number.isFinite(n) && n >= 0 ? n : null
}

router.get('/users', async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || '1'))
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '50')))
        const search = (req.query.search || '').trim()
        const planFilter = (req.query.plan || '').trim().toUpperCase()

        const where = {
            ...(search ? { OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { name:  { contains: search, mode: 'insensitive' } }
              ]} : {}),
            // Валидируем против конкретного списка планов — не пропускаем
            // произвольную строку в Prisma-фильтр напрямую из query.
            ...(['FREE', 'PRO', 'TEAM'].includes(planFilter) ? { plan: planFilter } : {})
        }

        const minMessengers = parseCountParam(req.query.minMessengers)
        const maxMessengers = parseCountParam(req.query.maxMessengers)
        const hasMessengerFilter = minMessengers !== null || maxMessengers !== null

        let result, total

        if (hasMessengerFilter) {
            // Prisma не поддерживает фильтрацию `where` по числу связанных
            // записей (_count) — только existence-фильтры (some/none/every).
            // Без раздутия схемы сырым SQL (schema.prisma живёт только на
            // сервере, вслепую по неизвестным именам таблиц не пишем) считаем
            // это в два шага: лёгкий запрос id+_count по всем подходящим под
            // остальные фильтры пользователям → фильтруем диапазон в JS →
            // тянем полную выборку только для id текущей страницы.
            const allMatching = await prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                select: { id: true, _count: { select: { messengers: true } } }
            })

            const filteredIds = allMatching
                .filter(u => {
                    const c = u._count.messengers
                    if (minMessengers !== null && c < minMessengers) return false
                    if (maxMessengers !== null && c > maxMessengers) return false
                    return true
                })
                .map(u => u.id)

            total = filteredIds.length
            const pageIds = filteredIds.slice((page - 1) * limit, (page - 1) * limit + limit)

            const users = await prisma.user.findMany({
                where: { id: { in: pageIds } },
                select: USER_SELECT
            })

            // `id: { in }` не сохраняет порядок — восстанавливаем порядок
            // страницы (createdAt desc), заданный в filteredIds выше.
            const byId = new Map(users.map(u => [u.id, u]))
            result = pageIds.map(id => byId.get(id)).filter(Boolean).map(mapUserRow)
        } else {
            const skip = (page - 1) * limit
            const [users, count] = await Promise.all([
                prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: USER_SELECT }),
                prisma.user.count({ where })
            ])
            result = users.map(mapUserRow)
            total = count
        }

        res.json({ users: result, total, page, pages: Math.ceil(total / limit) })
    } catch (err) {
        console.error('Admin /users error:', err)
        res.status(500).json({ error: 'Ошибка получения пользователей' })
    }
})

// ── GET /api/admin/users/:id ──────────────────────────────────────────────────
router.get('/users/:id', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, email: true, name: true, avatar: true,
                plan: true, planExpiresAt: true, isActive: true, isAdmin: true,
                lastSeenAt: true, createdAt: true,
                googleId: true, yandexId: true, githubId: true,
                telegramId: true, vkId: true, mailId: true, passwordHash: true,
                _count: { select: { messengers: true, folders: true, sessions: true } }
            }
        })
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
        // Security fix: never send the raw bcrypt hash to the client —
        // strip it from the object and expose only a boolean flag.
        const { passwordHash, _count, ...safeUser } = user
        res.json({
            ...safeUser,
            hasPassword: !!passwordHash,
            online:     isOnline(user.lastSeenAt),
            provider:   detectProvider(user),
            messengers: _count.messengers,
            folders:    _count.folders,
            sessions:   _count.sessions
        })
    } catch (err) {
        res.status(500).json({ error: 'Ошибка' })
    }
})

// ── PATCH /api/admin/users/:id/plan ──────────────────────────────────────────
router.patch('/users/:id/plan', async (req, res) => {
    try {
        const { plan, planExpiresAt } = req.body
        if (!['FREE', 'PRO', 'TEAM'].includes(plan)) {
            return res.status(400).json({ error: 'Неверный план. Допустимо: FREE, PRO, TEAM' })
        }
        const data = { plan }
        if (plan === 'FREE') {
            data.planExpiresAt = null
        } else if (planExpiresAt) {
            data.planExpiresAt = new Date(planExpiresAt)
        } else {
            const exp = new Date()
            exp.setFullYear(exp.getFullYear() + 1)
            data.planExpiresAt = exp
        }
        const user = await prisma.user.update({
            where: { id: req.params.id }, data,
            select: { id: true, email: true, plan: true, planExpiresAt: true }
        })
        audit(req, 'user.plan.update', { userId: req.params.id, plan, planExpiresAt: data.planExpiresAt })
        res.json({ ok: true, user })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Пользователь не найден' })
        res.status(500).json({ error: 'Ошибка обновления плана' })
    }
})

// ── PATCH /api/admin/users/:id/active ────────────────────────────────────────
router.patch('/users/:id/active', async (req, res) => {
    try {
        const { isActive } = req.body
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data:  { isActive: Boolean(isActive) },
            select: { id: true, email: true, isActive: true }
        })
        audit(req, 'user.active.update', { userId: req.params.id, isActive: Boolean(isActive) })
        res.json({ ok: true, user })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Пользователь не найден' })
        res.status(500).json({ error: 'Ошибка' })
    }
})

// ── DELETE /api/admin/users/:id ──────────────────────────────────────────────
// admin-server.tsx already calls this (fetch(`${API}/api/admin/users/${u.id}`,
// { method: 'DELETE', ... })) — the route was missing here, so every click on
// "Удалить пользователя" in the admin panel 404'd.
router.delete('/users/:id', async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } })
        audit(req, 'user.delete', { userId: req.params.id })
        res.json({ ok: true })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Пользователь не найден' })
        // FK constraint: user still owns messengers/folders/sessions/payments
        // that aren't set to cascade-delete at the schema level.
        if (err.code === 'P2003') {
            return res.status(409).json({ error: 'Нельзя удалить: у пользователя есть связанные данные (мессенджеры, платежи, сессии)' })
        }
        console.error('Admin DELETE /users/:id error:', err)
        res.status(500).json({ error: 'Ошибка удаления пользователя' })
    }
})

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [total, free, pro, team, onlineNow] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { plan: 'FREE' } }),
            prisma.user.count({ where: { plan: 'PRO'  } }),
            prisma.user.count({ where: { plan: 'TEAM' } }),
            prisma.user.count({
                where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } }
            })
        ])
        res.json({ total, free, pro, team, onlineNow })
    } catch (err) {
        res.status(500).json({ error: 'Ошибка статистики' })
    }
})

// ── GET /api/admin/visitors ───────────────────────────────────────────────────
router.get('/visitors', async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || '1'))
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '50')))
        const skip   = (page - 1) * limit
        const search = (req.query.search || '').trim()

        const where = search
            ? { OR: [
                { visitorId:  { contains: search, mode: 'insensitive' } },
                { platform:   { contains: search, mode: 'insensitive' } },
                { appVersion: { contains: search, mode: 'insensitive' } }
              ]}
            : {}

        const onlineThreshold = new Date(Date.now() - 15 * 60 * 1000)

        const [visitors, total, onlineNow] = await Promise.all([
            prisma.visitor.findMany({
                where, skip, take: limit,
                orderBy: { lastSeenAt: 'desc' }
            }),
            prisma.visitor.count({ where }),
            prisma.visitor.count({ where: { lastSeenAt: { gte: onlineThreshold } } })
        ])

        const result = visitors.map(v => ({
            ...v,
            online: v.lastSeenAt && new Date(v.lastSeenAt) >= onlineThreshold
        }))

        res.json({ visitors: result, total, page, pages: Math.ceil(total / limit), onlineNow })
    } catch (err) {
        console.error('Admin /visitors error:', err)
        res.status(500).json({ error: 'Ошибка получения посетителей' })
    }
})

// ── DELETE /api/admin/visitors/:id ───────────────────────────────────────────
router.delete('/visitors/:id', async (req, res) => {
    try {
        await prisma.visitor.delete({ where: { id: req.params.id } })
        audit(req, 'visitor.delete', { visitorId: req.params.id })
        res.json({ ok: true })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Не найден' })
        res.status(500).json({ error: 'Ошибка' })
    }
})

// ── Admin push notifications ─────────────────────────────────────────────────
// Restored from the live server during the Phase 1-3 deploy reconciliation —
// this repo's copy of admin-routes.js had never included these routes (they
// were added directly on the server at some point outside this repo's
// history), so a blind deploy of the hardened file would have silently
// 404'd the admin panel's notifications tab. Kept as-is functionally, only
// adding the same audit() logging already used for the other mutating routes
// above.
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await prisma.appNotification.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { reads: true } } }
        })
        res.json({ notifications })
    } catch (err) {
        console.error('Admin GET /notifications error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.post('/notifications', async (req, res) => {
    try {
        const { title, body, imageUrl, actionLabel, actionUrl } = req.body
        if (!title || !body) {
            return res.status(400).json({ error: 'title and body required' })
        }
        const notif = await prisma.appNotification.create({
            data: {
                title:       String(title).slice(0, 255),
                body:        String(body).slice(0, 2000),
                imageUrl:    imageUrl    ? String(imageUrl).slice(0, 500)    : null,
                actionLabel: actionLabel ? String(actionLabel).slice(0, 100) : null,
                actionUrl:   actionUrl   ? String(actionUrl).slice(0, 500)   : null,
            }
        })
        audit(req, 'notification.create', { id: notif.id, title: notif.title })
        console.log('[Admin] Notification created:', notif.id, notif.title)
        res.json({ ok: true, notification: notif })
    } catch (err) {
        console.error('Admin POST /notifications error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.delete('/notifications/:id', async (req, res) => {
    try {
        await prisma.appNotification.delete({ where: { id: req.params.id } })
        audit(req, 'notification.delete', { id: req.params.id })
        res.json({ ok: true })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' })
        res.status(500).json({ error: 'Server error' })
    }
})

// ── Promo codes ────────────────────────────────────────────────────────
// Admin-only creation surface for the codes users redeem via
// POST /api/payments/promo/redeem (routes/payments.js). Redemption itself
// (validation, one-per-user-per-code enforcement, granting months of Pro)
// lives there — this file only manages the code catalogue.
router.get('/promo-codes', async (req, res) => {
    try {
        const codes = await prisma.promoCode.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { redemptions: true } } }
        })
        res.json({ codes })
    } catch (err) {
        console.error('Admin GET /promo-codes error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.post('/promo-codes', async (req, res) => {
    try {
        const { code, months, days, maxUses, expiresAt } = req.body
        const normalized = String(code || '').trim().toUpperCase().slice(0, 40)
        if (!normalized) return res.status(400).json({ error: 'code обязателен' })

        // A code grants either whole months or a fixed number of days — never
        // both — so redeem logic (payments-server.js) can branch on which one
        // is set without ambiguity.
        const hasMonths = months != null && months !== ''
        const hasDays = days != null && days !== ''
        if (hasMonths === hasDays) {
            return res.status(400).json({ error: 'Укажите либо months, либо days (ровно один из параметров)' })
        }
        let monthsNum = null, daysNum = null
        if (hasMonths) {
            monthsNum = parseInt(months, 10)
            if (!Number.isInteger(monthsNum) || monthsNum < 1 || monthsNum > 24) {
                return res.status(400).json({ error: 'months должен быть целым числом от 1 до 24' })
            }
        } else {
            daysNum = parseInt(days, 10)
            if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 366) {
                return res.status(400).json({ error: 'days должен быть целым числом от 1 до 366' })
            }
        }
        const maxUsesNum = maxUses != null && maxUses !== '' ? parseInt(maxUses, 10) : null
        if (maxUsesNum != null && (!Number.isInteger(maxUsesNum) || maxUsesNum < 1)) {
            return res.status(400).json({ error: 'maxUses должен быть положительным целым числом или пустым (безлимит)' })
        }
        const promo = await prisma.promoCode.create({
            data: {
                code: normalized,
                months: monthsNum,
                days: daysNum,
                maxUses: maxUsesNum,
                expiresAt: expiresAt ? new Date(expiresAt) : null
            }
        })
        audit(req, 'promo.create', { id: promo.id, code: promo.code, months: promo.months, days: promo.days })
        res.json({ ok: true, code: promo })
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Такой код уже существует' })
        console.error('Admin POST /promo-codes error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.patch('/promo-codes/:id/active', async (req, res) => {
    try {
        const promo = await prisma.promoCode.update({
            where: { id: req.params.id },
            data: { isActive: Boolean(req.body.isActive) }
        })
        audit(req, 'promo.active.update', { id: promo.id, isActive: promo.isActive })
        res.json({ ok: true, code: promo })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Не найден' })
        res.status(500).json({ error: 'Server error' })
    }
})

router.delete('/promo-codes/:id', async (req, res) => {
    try {
        await prisma.promoCode.delete({ where: { id: req.params.id } })
        audit(req, 'promo.delete', { id: req.params.id })
        res.json({ ok: true })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Не найден' })
        // FK constraint: code already has redemptions — deactivate instead of deleting
        if (err.code === 'P2003') return res.status(409).json({ error: 'Нельзя удалить код с активациями — деактивируйте вместо удаления' })
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /api/admin/users/:id/payments — also restored from live (see note above).
// Not a duplicate of anything else in this file.
router.get('/users/:id/payments', async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            where: { userId: req.params.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true, amount: true, currency: true, status: true, plan: true, months: true, createdAt: true }
        })
        res.json({ payments })
    } catch (err) {
        res.status(500).json({ error: 'Server error' })
    }
})

// NOTE: the live server also has a second, older, unaudited
// `router.delete('/users/:id', ...)` defined after this point. It's dead
// code — Express dispatches to the first matching route, and this file
// already defines '/users/:id' DELETE above (line ~211) with audit logging
// and FK-constraint handling — so it's intentionally not carried over here.

// ── Support tickets ───────────────────────────────────────────────────
// User-facing create/list/reply endpoints live in routes/tickets.js. This
// block is the admin queue: list all tickets (optionally filtered by
// status), read a full thread, reply (flips status -> ANSWERED and emails
// the user), and an explicit close/reopen toggle.
const { sendTicketReplyEmail } = require('../lib/email')
const { createTicketTopic, postTicketMessage, closeTicketTopic, reopenTicketTopic, postToNewsChannel, escapeHtml } = require('../lib/telegram-bot')
const { ARTICLES, articleUrl, suggestedPostText } = require('../lib/blog-articles')

router.get('/tickets', async (req, res) => {
    try {
        const { status } = req.query
        const where = status ? { status: String(status).toUpperCase() } : {}
        const tickets = await prisma.ticket.findMany({
            where,
            include: {
                user: { select: { id: true, email: true, name: true } },
                _count: { select: { messages: true } }
            },
            orderBy: { updatedAt: 'desc' }
        })
        res.json({ tickets })
    } catch (err) {
        console.error('Admin GET /tickets error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.get('/tickets/:id', async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { id: true, email: true, name: true } },
                messages: { orderBy: { createdAt: 'asc' } }
            }
        })
        if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' })
        res.json(ticket)
    } catch (err) {
        console.error('Admin GET /tickets/:id error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.post('/tickets/:id/messages', async (req, res) => {
    try {
        const { body } = req.body
        if (!body || !String(body).trim()) return res.status(400).json({ error: 'Введите сообщение' })

        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { user: { select: { id: true, email: true, name: true } } }
        })
        if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' })

        const [message] = await prisma.$transaction([
            prisma.ticketMessage.create({ data: { ticketId: ticket.id, isAdmin: true, body: String(body).trim() } }),
            prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'ANSWERED' } })
        ])

        audit(req, 'ticket.reply', { id: ticket.id, userId: ticket.userId })

        // Fire-and-forget: sendEmail() itself fails soft (no RESEND_API_KEY
        // = no-op), so this never blocks the admin reply on email delivery.
        sendTicketReplyEmail(ticket.user, ticket, message.body)
            .catch(e => console.error('[tickets] reply email failed:', e.message))

        res.status(201).json({ ok: true, message })

        // Fire-and-forget Telegram mirror (runs after the response is sent,
        // matching the other three sync sites in tickets-server.js/here).
        // Replies made here (the web dashboard) get echoed into the topic so
        // the thread stays complete no matter which side the admin answers
        // from. Replies that originate the other way (admin typing directly
        // in Telegram) come in via the webhook, which writes straight to the
        // DB and does NOT call back into postTicketMessage() — that
        // asymmetry is what prevents an infinite echo loop between the two
        // channels.
        ;(async () => {
            try {
                let threadId = ticket.telegramTopicId
                if (!threadId) {
                    // Ticket predates the Telegram integration (or topic
                    // creation failed originally) — create one lazily.
                    threadId = await createTicketTopic(ticket)
                    if (threadId) await prisma.ticket.update({ where: { id: ticket.id }, data: { telegramTopicId: threadId } })
                }
                if (!threadId) return
                await postTicketMessage(threadId, `<b>Ответ администратора (сайт)</b>\n\n${escapeHtml(message.body)}`)
            } catch (e) { console.error('[tickets] telegram sync (admin reply) failed:', e.message) }
        })()
    } catch (err) {
        console.error('Admin POST /tickets/:id/messages error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.patch('/tickets/:id/status', async (req, res) => {
    try {
        const { status } = req.body
        if (!['OPEN', 'ANSWERED', 'CLOSED'].includes(status)) {
            return res.status(400).json({ error: 'Некорректный статус' })
        }
        const ticket = await prisma.ticket.update({ where: { id: req.params.id }, data: { status } })
        audit(req, 'ticket.status.update', { id: ticket.id, status })
        res.json({ ok: true, ticket })

        if (ticket.telegramTopicId) {
            const syncTopic = status === 'CLOSED' ? closeTicketTopic : reopenTicketTopic
            // OPEN/ANSWERED both just need the topic open (reopen is a no-op
            // on an already-open topic per the Bot API).
            syncTopic(ticket.telegramTopicId).catch(e => console.error('[tickets] telegram topic sync failed:', e.message))
        }
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Не найден' })
        console.error('Admin PATCH /tickets/:id/status error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

// ── Новостной канал (@centrioapp, публичный broadcast-канал в Telegram) ────
// Отдельно от tickets-топиков: postToNewsChannel шлёт в NEWS_CHAT_ID
// (публичный канал), а не в приватную форум-супергруппу поддержки — см.
// шапку lib/telegram-bot.js. NewsPost — история уже опубликованного, чтобы
// (а) не предлагать в кандидатах статью, которая уже была в канале, и
// (б) не дать дважды опубликовать одну и ту же статью (уникальный slug).
router.get('/news/candidates', async (req, res) => {
    try {
        const posted = await prisma.newsPost.findMany({ where: { slug: { not: null } }, select: { slug: true } })
        const postedSlugs = new Set(posted.map(p => p.slug))
        const candidates = ARTICLES
            .filter(a => !postedSlugs.has(a.slug))
            .map(a => ({ slug: a.slug, title: a.title, url: articleUrl(a.slug), suggestedText: suggestedPostText(a) }))
        res.json({ candidates })
    } catch (err) {
        console.error('Admin GET /news/candidates error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.get('/news', async (req, res) => {
    try {
        const posts = await prisma.newsPost.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
        res.json({ posts })
    } catch (err) {
        console.error('Admin GET /news error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.post('/news', async (req, res) => {
    try {
        const { text, slug, disablePreview } = req.body || {}
        if (!text || !String(text).trim()) {
            return res.status(400).json({ error: 'Укажите текст поста' })
        }
        const trimmed = String(text).trim()

        // Telegram's sendMessage hard limit is 4096 chars; lib/telegram-bot.js
        // clip()s to 3900 before sending so the call itself never fails on
        // length — but silently truncating a public post is the wrong
        // failure mode (the admin would have no idea it happened). Reject
        // up front instead so they shorten it themselves.
        if (trimmed.length > 3900) {
            return res.status(400).json({ error: `Текст слишком длинный (${trimmed.length} символов, максимум 3900) — сократите пост` })
        }

        const title = (slug && ARTICLES.find(a => a.slug === slug)?.title) || trimmed.slice(0, 80)

        // Claim the slug in the DB BEFORE sending to Telegram — not after,
        // like an earlier version of this route did. That ordering had a
        // real race: two near-simultaneous requests for the same article
        // could both pass a pre-send existence check and both actually
        // broadcast to the public channel, with the unique index only
        // catching the *second DB row* (by which point the duplicate
        // message had already gone out, and the catch block below would
        // mask it as a success). Claiming first makes the unique index gate
        // the send itself: the loser gets a 409 and never calls
        // postToNewsChannel at all. Manual posts (slug: null) skip this —
        // Postgres treats every NULL as distinct under the unique index, so
        // there's no dedup invariant to protect for them.
        let claim = null
        if (slug) {
            try {
                claim = await prisma.newsPost.create({ data: { slug, title, telegramMessageId: null } })
            } catch (dbErr) {
                if (dbErr.code === 'P2002') return res.status(409).json({ error: 'Эта статья уже опубликована в канале' })
                throw dbErr
            }
        }

        const result = await postToNewsChannel(trimmed, { disablePreview: !!disablePreview })
        if (!result) {
            // Send failed — release the claim so the slug isn't stuck
            // "posted" forever and the admin can retry.
            if (claim) await prisma.newsPost.delete({ where: { id: claim.id } }).catch(() => {})
            return res.status(502).json({ error: 'Не удалось отправить сообщение в Telegram — проверьте логи сервера' })
        }

        let post
        try {
            post = claim
                ? await prisma.newsPost.update({ where: { id: claim.id }, data: { telegramMessageId: result.message_id || null } })
                : await prisma.newsPost.create({ data: { slug: null, title, telegramMessageId: result.message_id || null } })
        } catch (dbErr) {
            // Сообщение уже реально ушло в публичный канал — сбой записи в
            // БД не должен выглядеть как сбой всей операции (иначе админ
            // повторит попытку и продублирует пост). Громко логируем,
            // отвечаем успехом; в истории просто не будет этой записи.
            console.error('[news] posted to Telegram but failed to record NewsPost:', dbErr.message)
            post = { slug: slug || null, title, telegramMessageId: result.message_id || null, createdAt: new Date() }
        }

        res.status(201).json({ ok: true, post })
        audit(req, 'news.post', { slug: slug || null, telegramMessageId: result.message_id })
    } catch (err) {
        console.error('Admin POST /news error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

// ── Рассылки (broadcast emails) ─────────────────────────────────────
// Broadcast model added via landing/schema-broadcast.js, already applied
// and live on the server (confirmed in prisma/schema.prisma).
const BROADCAST_AUDIENCES = { ALL: {}, FREE: { plan: 'FREE' }, PRO: { plan: { in: ['PRO', 'TEAM'] } } }

function broadcastEscapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Sends are done in small concurrent batches with a short pause between
// batches — a plain "send to everyone in parallel" risks tripping the
// email provider's rate limit at any real user count; a fully sequential
// loop would just be needlessly slow. Runs after the HTTP response is
// already sent (see POST / below), updating sentCount/failedCount on the
// Broadcast row as it goes so GET /:id can be polled for live progress.
const BROADCAST_BATCH_SIZE = 10
const BROADCAST_BATCH_DELAY_MS = 1000

async function runBroadcastSend(broadcastId, users, subject, html) {
    let sent = 0
    let failed = 0
    for (let i = 0; i < users.length; i += BROADCAST_BATCH_SIZE) {
        const batch = users.slice(i, i + BROADCAST_BATCH_SIZE)
        const results = await Promise.allSettled(
            batch.map(u => sendEmail({ to: u.email, subject, html }))
        )
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value?.ok) sent++
            else failed++
        }
        await prisma.broadcast.update({ where: { id: broadcastId }, data: { sentCount: sent, failedCount: failed } })
        if (i + BROADCAST_BATCH_SIZE < users.length) {
            await new Promise(resolve => setTimeout(resolve, BROADCAST_BATCH_DELAY_MS))
        }
    }
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'SENT', finishedAt: new Date() } })
}

router.get('/broadcasts', async (req, res) => {
    try {
        const broadcasts = await prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
        res.json({ broadcasts })
    } catch (err) {
        console.error('Admin GET /broadcasts error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.get('/broadcasts/:id', async (req, res) => {
    try {
        const broadcast = await prisma.broadcast.findUnique({ where: { id: req.params.id } })
        if (!broadcast) return res.status(404).json({ error: 'Не найдено' })
        res.json({ broadcast })
    } catch (err) {
        console.error('Admin GET /broadcasts/:id error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

router.post('/broadcasts', async (req, res) => {
    try {
        const { subject, bodyText, audience } = req.body || {}
        if (!subject?.trim() || !bodyText?.trim()) {
            return res.status(400).json({ error: 'Укажите тему и текст письма' })
        }
        const aud = BROADCAST_AUDIENCES[audience] ? audience : 'ALL'

        const users = await prisma.user.findMany({
            where: { isActive: true, ...BROADCAST_AUDIENCES[aud] },
            select: { email: true }
        })

        const broadcast = await prisma.broadcast.create({
            data: {
                subject: subject.trim(),
                bodyText: bodyText.trim(),
                audience: aud,
                status: 'SENDING',
                totalCount: users.length,
            }
        })

        const html = broadcastEscapeHtml(bodyText.trim())
            .split(/\n{2,}/)
            .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('')

        // Respond immediately with the created broadcast (status SENDING) —
        // the actual send loop can take a while for a large audience, no
        // reason to hold the admin's request open for it.
        res.status(201).json({ ok: true, broadcast })
        audit(req, 'broadcast.create', { id: broadcast.id, audience: aud, totalCount: users.length })

        runBroadcastSend(broadcast.id, users, subject.trim(), html).catch(e => {
            console.error('[broadcast] send loop failed:', e.message)
            prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: 'FAILED', finishedAt: new Date() } }).catch(() => {})
        })
    } catch (err) {
        console.error('Admin POST /broadcasts error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router
