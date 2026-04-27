const router = require('express').Router()
const axios  = require('axios')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const prisma = require('../utils/prisma')

const YK_SHOP   = process.env.YUKASSA_SHOP_ID
const YK_SECRET = process.env.YUKASSA_SECRET_KEY
const YK_API    = 'https://api.yookassa.ru/v3'
const FRONT     = process.env.FRONTEND_URL || 'https://centrio.me'

const PLANS = {
  month: { price: '199.00', months: 1,  label: 'Centrio Pro — 1 месяц' },
  year:  { price: '1590.00', months: 12, label: 'Centrio Pro — 1 год'  }
}

function ykAuth () { return { username: YK_SHOP, password: YK_SECRET } }

// ── GET /api/payments/plans ────────────────────────────────────────
router.get('/plans', (_req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'FREE', name: 'Бесплатный', price: 0,
        features: ['До 5 сервисов', 'Базовые функции', 'Уведомления']
      },
      {
        id: 'PRO_MONTH', name: 'Pro — Месяц', price: 199, per: 'month',
        features: ['Безлимит сервисов', 'Облачная синхронизация', 'Папки', 'Поддержка']
      },
      {
        id: 'PRO_YEAR', name: 'Pro — Год', price: 1590, pricePerMonth: 133, per: 'year',
        features: ['Всё из Pro Месяц', 'Приоритетная поддержка', 'Ранний доступ']
      }
    ]
  })
})

// ── POST /api/payments/create ──────────────────────────────────────
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body          // 'month' | 'year'
    const cfg = PLANS[plan]
    if (!cfg) return res.status(400).json({ success: false, error: 'Неверный план' })

    const ikey = uuidv4()

    const { data: yk } = await axios.post(`${YK_API}/payments`, {
      amount:       { value: cfg.price, currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: `${FRONT}/payment/success?plan=${plan}` },
      capture:      true,
      description:  cfg.label,
      metadata:     { userId: req.user.id, plan, months: cfg.months },
      receipt: {
        customer: { email: req.user.email },
        items: [{
          description:     cfg.label,
          quantity:        '1.00',
          amount:          { value: cfg.price, currency: 'RUB' },
          vat_code:        1,          // без НДС (ИП на УСН)
          payment_mode:    'full_payment',
          payment_subject: 'service'
        }]
      }
    }, {
      auth:    ykAuth(),
      headers: { 'Idempotence-Key': ikey }
    })

    await prisma.payment.create({
      data: {
        userId:       req.user.id,
        amount:       parseFloat(cfg.price),
        currency:     'RUB',
        status:       'PENDING',
        provider:     'yookassa',
        providerPayId: yk.id,
        plan:         'PRO',
        months:       cfg.months
      }
    })

    res.json({ success: true, data: { paymentId: yk.id, confirmationUrl: yk.confirmation.confirmation_url } })
  } catch (err) {
    console.error('Payment create:', err.response?.data || err.message)
    res.status(500).json({ success: false, error: 'Ошибка создания платежа' })
  }
})

// ── POST /api/payments/webhook  (ЮКасса → сервер) ─────────────────
router.post('/webhook', async (req, res) => {
  try {
    const { event, object: yk } = req.body || {}
    if (!yk) return res.status(400).json({ error: 'Bad payload' })

    if (event === 'payment.succeeded') {
      const payment = await prisma.payment.findUnique({ where: { providerPayId: yk.id } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      await prisma.payment.update({
        where: { providerPayId: yk.id },
        data:  { status: 'SUCCEEDED' }
      })

      // Устанавливаем/продлеваем подписку
      // Стакуем только если уже PRO с актуальной датой; если FREE — считаем от сейчас
      const user = await prisma.user.findUnique({ where: { id: payment.userId } })
      const now  = new Date()
      const alreadyPro = user.plan === 'PRO' && user.planExpiresAt && user.planExpiresAt > now
      const base = alreadyPro ? user.planExpiresAt : now
      const exp  = new Date(base)
      exp.setMonth(exp.getMonth() + payment.months)

      await prisma.user.update({
        where: { id: payment.userId },
        data:  { plan: 'PRO', planExpiresAt: exp }
      })

      console.log(`✅ Payment OK: user=${payment.userId} PRO until ${exp.toISOString()}`)
    }

    if (event === 'payment.canceled') {
      await prisma.payment.updateMany({
        where: { providerPayId: yk.id },
        data:  { status: 'CANCELLED' }
      })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── GET /api/payments/status/:paymentId ───────────────────────────
router.get('/status/:paymentId', authMiddleware, async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { providerPayId: req.params.paymentId, userId: req.user.id }
    })
    if (!payment) return res.status(404).json({ success: false, error: 'Не найден' })

    const { data: yk } = await axios.get(`${YK_API}/payments/${req.params.paymentId}`, { auth: ykAuth() })

    // Если YK говорит succeeded — обновим статус (на случай если webhook не дошёл)
    if (yk.status === 'succeeded' && payment.status !== 'SUCCEEDED') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } })
      const user = await prisma.user.findUnique({ where: { id: payment.userId } })
      const now  = new Date()
      const alreadyPro = user.plan === 'PRO' && user.planExpiresAt && user.planExpiresAt > now
      const base = alreadyPro ? user.planExpiresAt : now
      const exp  = new Date(base)
      exp.setMonth(exp.getMonth() + payment.months)
      await prisma.user.update({ where: { id: payment.userId }, data: { plan: 'PRO', planExpiresAt: exp } })
    }

    res.json({ success: true, data: { ykStatus: yk.status, payment } })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка проверки статуса' })
  }
})

// ── GET /api/payments/my ──────────────────────────────────────────
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take:    20
    })
    res.json({ success: true, data: payments })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка получения платежей' })
  }
})

module.exports = router
