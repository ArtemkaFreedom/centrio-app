const router = require('express').Router()
const prisma  = require('../utils/prisma')
const { getQrDataUrl, verifyTotp, checkSession } = require('../utils/admin-otp')

// ── Открытые маршруты (без auth) ──────────────────────────────────────────────

// GET /api/admin/setup-qr  — QR-код для первичной настройки
// Защищён отдельным ключом SETUP_KEY из .env — знаете только вы
router.get('/setup-qr', async (req, res) => {
    const key = req.headers['x-setup-key'] || req.query.key
    if (!key || key !== process.env.SETUP_KEY) {
        return res.status(403).json({ error: 'Forbidden' })
    }
    try {
        const qr = await getQrDataUrl()
        res.json({ qr, secret: process.env.TOTP_SECRET })
    } catch (err) {
        res.status(500).json({ error: 'Ошибка генерации QR: ' + err.message })
    }
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
router.get('/users', async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || '1'))
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '50')))
        const skip   = (page - 1) * limit
        const search = (req.query.search || '').trim()

        const where = search
            ? { OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { name:  { contains: search, mode: 'insensitive' } }
              ]}
            : {}

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where, skip, take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, email: true, name: true, avatar: true,
                    plan: true, planExpiresAt: true, isActive: true, isAdmin: true,
                    lastSeenAt: true, createdAt: true, autoRenew: true,
                    googleId: true, yandexId: true, githubId: true,
                    telegramId: true, vkId: true, mailId: true, passwordHash: true,
                    _count: { select: { messengers: true, folders: true, sessions: true } }
                }
            }),
            prisma.user.count({ where })
        ])

        const result = users.map(u => ({
            id: u.id, email: u.email, name: u.name, avatar: u.avatar,
            plan: u.plan, planExpiresAt: u.planExpiresAt,
            isActive: u.isActive, isAdmin: u.isAdmin,
            lastSeenAt: u.lastSeenAt, createdAt: u.createdAt,
            autoRenew:  u.autoRenew || false,
            online:     isOnline(u.lastSeenAt),
            provider:   detectProvider(u),
            messengers: u._count.messengers,
            folders:    u._count.folders,
            sessions:   u._count.sessions
        }))

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
        res.json({
            ...user,
            online:     isOnline(user.lastSeenAt),
            provider:   detectProvider(user),
            messengers: user._count.messengers,
            folders:    user._count.folders,
            sessions:   user._count.sessions
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

module.exports = router
