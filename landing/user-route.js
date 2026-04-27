const router = require('express').Router()
const authMiddleware = require('../middleware/auth')
const prisma = require('../utils/prisma')
const bcrypt = require('bcryptjs')

// GET /api/user/profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, avatar: true,
        plan: true, planExpiresAt: true, createdAt: true,
        _count: { select: { messengers: true, folders: true } }
      }
    })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения профиля' })
  }
})

// PUT /api/user/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, avatar },
      select: { id: true, email: true, name: true, avatar: true, plan: true }
    })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления профиля' })
  }
})

// PUT /api/user/password
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 8 символов' })
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (user.passwordHash) {
      if (!currentPassword) return res.status(400).json({ error: 'Введите текущий пароль' })
      const ok = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!ok) return res.status(401).json({ error: 'Неверный текущий пароль' })
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash } })
    res.json({ message: 'Пароль обновлён' })
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления пароля' })
  }
})

// GET /api/user/devices — list active sessions
router.get('/devices', authMiddleware, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, expiresAt: { gt: new Date() } },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' }
    })

    // Parse user-agent into friendly device info
    const parsed = sessions.map(s => {
      const ua = s.deviceInfo || ''
      let os = 'Неизвестная ОС'
      let browser = ''
      let icon = '💻'

      if (/Windows/i.test(ua))      { os = 'Windows'; icon = '🖥️' }
      else if (/Macintosh|Mac OS/i.test(ua)) { os = 'macOS'; icon = '🍎' }
      else if (/Linux/i.test(ua))   { os = 'Linux'; icon = '🐧' }
      else if (/Android/i.test(ua)) { os = 'Android'; icon = '📱' }
      else if (/iPhone|iPad/i.test(ua)) { os = 'iOS'; icon = '📱' }
      else if (/Electron/i.test(ua)) { os = 'Centrio App'; icon = '⚡' }

      if (/Electron/i.test(ua))      browser = 'Centrio Desktop'
      else if (/Chrome/i.test(ua))   browser = 'Chrome'
      else if (/Firefox/i.test(ua))  browser = 'Firefox'
      else if (/Safari/i.test(ua))   browser = 'Safari'
      else if (/Edge/i.test(ua))     browser = 'Edge'

      return {
        id: s.id,
        os,
        browser,
        icon,
        ipAddress: s.ipAddress || '—',
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        label: browser ? `${browser} · ${os}` : os
      }
    })

    res.json({ devices: parsed, total: parsed.length })
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения устройств' })
  }
})

// DELETE /api/user/devices/:id — revoke session
router.delete('/devices/:id', authMiddleware, async (req, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' })
    await prisma.session.delete({ where: { id: req.params.id } })
    res.json({ message: 'Устройство отключено' })
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отключения устройства' })
  }
})

// DELETE /api/user/devices — revoke all except current
router.delete('/devices', authMiddleware, async (req, res) => {
  try {
    const { currentSessionId } = req.body
    await prisma.session.deleteMany({
      where: {
        userId: req.user.id,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {})
      }
    })
    res.json({ message: 'Все устройства отключены' })
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отключения устройств' })
  }
})

module.exports = router
