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
router.post('/verify-totp', (req, res) => {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Код не передан' })
    const result = verifyTotp(code)
    if (!result.ok) return res.status(401).json({ error: result.error })
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
        res.json({ ok: true, user })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Пользователь не найден' })
        res.status(500).json({ error: 'Ошибка' })
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
        res.json({ ok: true })
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Не найден' })
        res.status(500).json({ error: 'Ошибка' })
    }
})

module.exports = router
