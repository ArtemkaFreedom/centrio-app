const router = require('express').Router()
const fs = require('fs')
const path = require('path')
const authMiddleware = require('../middleware/auth')
const prisma = require('../utils/prisma')

// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const notifications = await prisma.appNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        reads: {
          where: { userId },
          select: { id: true }
        }
      }
    })

    const result = notifications.map(n => ({
      id:          n.id,
      title:       n.title,
      body:        n.body,
      createdAt:   n.createdAt,
      imageUrl:    n.imageUrl    || null,
      actionLabel: n.actionLabel || null,
      actionUrl:   n.actionUrl   || null,
      isRead:      n.reads.length > 0
    }))

    res.json({ success: true, data: result })
  } catch (e) {
    console.error('[notifications GET]', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/notifications/read-all
router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const allNotifs = await prisma.appNotification.findMany({
      select: { id: true }
    })

    if (allNotifs.length > 0) {
      await prisma.appNotificationRead.createMany({
        data: allNotifs.map(n => ({ notificationId: n.id, userId })),
        skipDuplicates: true
      })
    }

    res.json({ success: true })
  } catch (e) {
    console.error('[notifications read-all]', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/notifications/subscribe — newsletter sign-up (no auth required)
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' })
    }
    const normalized = email.trim().toLowerCase()

    // Try Prisma model (table may not exist yet — graceful fallback)
    try {
      await prisma.newsletterSubscription.upsert({
        where: { email: normalized },
        update: {},
        create: { email: normalized },
      })
      return res.json({ ok: true })
    } catch (_) {
      // Model doesn't exist — log to file instead
      const logPath = path.join(__dirname, '..', 'newsletter-emails.txt')
      fs.appendFileSync(logPath, `${new Date().toISOString()}\t${normalized}\n`)
      return res.json({ ok: true })
    }
  } catch (err) {
    console.error('Subscribe error:', err)
    res.json({ ok: true }) // never block UX
  }
})

module.exports = router
