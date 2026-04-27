// POST /api/visitors/ping  — анонимный пинг от неавторизованных пользователей
// Вызывается из Electron-приложения каждые 5 минут, если нет auth-токена.
const router = require('express').Router()
const prisma  = require('../utils/prisma')

router.post('/ping', async (req, res) => {
    try {
        const { visitorId, platform, appVersion, messengersCount } = req.body
        if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 64) {
            return res.status(400).json({ error: 'Неверный visitorId' })
        }

        const existing = await prisma.visitor.findUnique({ where: { visitorId } })

        if (existing) {
            await prisma.visitor.update({
                where: { visitorId },
                data: {
                    lastSeenAt:     new Date(),
                    sessions:       { increment: 0 },   // обновляется только lastSeenAt
                    ...(platform     ? { platform }     : {}),
                    ...(appVersion   ? { appVersion }   : {}),
                    ...(typeof messengersCount === 'number' ? { messengersCount } : {})
                }
            })
        } else {
            await prisma.visitor.create({
                data: {
                    visitorId,
                    platform:        platform     || null,
                    appVersion:      appVersion   || null,
                    messengersCount: messengersCount || 0,
                    sessions:        1
                }
            })
        }

        res.json({ ok: true })
    } catch (err) {
        console.error('/visitors/ping error:', err.message)
        res.status(500).json({ error: 'Ошибка' })
    }
})

// POST /api/visitors/session — новая сессия (инкрементирует счётчик)
router.post('/session', async (req, res) => {
    try {
        const { visitorId, platform, appVersion } = req.body
        if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 64) {
            return res.status(400).json({ error: 'Неверный visitorId' })
        }

        await prisma.visitor.upsert({
            where:  { visitorId },
            update: {
                lastSeenAt: new Date(),
                sessions:   { increment: 1 },
                ...(platform   ? { platform }   : {}),
                ...(appVersion ? { appVersion } : {})
            },
            create: {
                visitorId,
                platform:   platform   || null,
                appVersion: appVersion || null,
                sessions:   1
            }
        })

        res.json({ ok: true })
    } catch (err) {
        console.error('/visitors/session error:', err.message)
        res.status(500).json({ error: 'Ошибка' })
    }
})

module.exports = router
