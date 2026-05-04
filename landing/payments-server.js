const router  = require('express').Router()
const axios   = require('axios')
const crypto  = require('crypto')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const prisma  = require('../utils/prisma')

const YK_SHOP   = process.env.YUKASSA_SHOP_ID
const YK_SECRET = process.env.YUKASSA_SECRET_KEY
const YK_API    = 'https://api.yookassa.ru/v3'
const FRONT     = process.env.FRONTEND_URL || 'https://centrio.me'

const FRIDE_API_KEY      = process.env.FRIDE_API_KEY      || 'MjI2Y2IzMDEtZWEzNi00YjQ0LWI1OTktZjZmNDg1NjY0OTg1OlRlTmZfMHpjKldAc3hVc05ARzlENEdOS2kkNWRTM2Nr'
const FRIDE_MERCHANT_ID  = process.env.FRIDE_MERCHANT_ID  || ''
const FRIDE_WEBHOOK_KEY  = process.env.FRIDE_WEBHOOK_KEY  || '5521541e9425f1de6157a89232e3c9f3'
const FRIDE_API          = 'https://api.fride.io'

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
      { id: 'FREE', name: 'Бесплатный', price: 0,
        features: ['До 5 сервисов', 'Базовые функции', 'Уведомления'] },
      { id: 'PRO_MONTH', name: 'Pro — Месяц', price: 199, per: 'month',
        features: ['Безлимит сервисов', 'Облачная синхронизация', 'Папки', 'Поддержка'] },
      { id: 'PRO_YEAR', name: 'Pro — Год', price: 1590, pricePerMonth: 133, per: 'year',
        features: ['Всё из Pro Месяц', 'Приоритетная поддержка', 'Ранний доступ'] }
    ]
  })
})

// ── POST /api/payments/create ──────────────────────────────────────
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body
    const cfg = PLANS[plan]
    if (!cfg) return res.status(400).json({ success: false, error: 'Неверный план' })

    const ikey = uuidv4()

    const { data: yk } = await axios.post(`${YK_API}/payments`, {
      amount:       { value: cfg.price, currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: `${FRONT}/payment/success?plan=${plan}` },
      capture:      true,
      description:  cfg.label,
      save_payment_method: true,
      metadata:     { userId: req.user.id, plan, months: cfg.months },
      receipt: {
        customer: { email: req.user.email },
        items: [{
          description:     cfg.label,
          quantity:        '1.00',
          amount:          { value: cfg.price, currency: 'RUB' },
          vat_code:        1,
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

// ── POST /api/payments/webhook ─────────────────────────────────────
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

      const user = await prisma.user.findUnique({ where: { id: payment.userId } })
      const now  = new Date()
      const alreadyPro = user.plan === 'PRO' && user.planExpiresAt && user.planExpiresAt > now
      const base = alreadyPro ? user.planExpiresAt : now
      const exp  = new Date(base)
      exp.setMonth(exp.getMonth() + payment.months)

      const updateData = { plan: 'PRO', planExpiresAt: exp, autoRenew: true }
      if (yk.payment_method && yk.payment_method.saved) {
        updateData.autoRenewPayMethodId = yk.payment_method.id
      }

      await prisma.user.update({ where: { id: payment.userId }, data: updateData })
      console.log('Payment OK: user=' + payment.userId + ' PRO until ' + exp.toISOString())
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

    if (yk.status === 'succeeded' && payment.status !== 'SUCCEEDED') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } })
      const user = await prisma.user.findUnique({ where: { id: payment.userId } })
      const now  = new Date()
      const alreadyPro = user.plan === 'PRO' && user.planExpiresAt && user.planExpiresAt > now
      const base = alreadyPro ? user.planExpiresAt : now
      const exp  = new Date(base)
      exp.setMonth(exp.getMonth() + payment.months)
      const updateData = { plan: 'PRO', planExpiresAt: exp, autoRenew: true }
      if (yk.payment_method && yk.payment_method.saved) {
        updateData.autoRenewPayMethodId = yk.payment_method.id
      }
      await prisma.user.update({ where: { id: payment.userId }, data: updateData })
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

// ── GET /api/payments/auto-renew ─────────────────────────────────
router.get('/auto-renew', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: { autoRenew: true, autoRenewPayMethodId: true, planExpiresAt: true }
    })
    res.json({
      success: true,
      data: {
        autoRenew: user.autoRenew,
        hasMethod: !!user.autoRenewPayMethodId,
        expiresAt: user.planExpiresAt
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка' })
  }
})

// ── PATCH /api/payments/auto-renew ───────────────────────────────
router.patch('/auto-renew', authMiddleware, async (req, res) => {
  try {
    const { enabled } = req.body
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { autoRenew: !!enabled }
    })
    res.json({ success: true, data: { autoRenew: !!enabled } })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка' })
  }
})

// ── POST /api/payments/fride-create ──────────────────────────────
router.post('/fride-create', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body
    const cfg = PLANS[plan]
    if (!cfg) return res.status(400).json({ success: false, error: 'Неверный план' })
    if (!FRIDE_MERCHANT_ID) return res.status(503).json({ success: false, error: 'FRIDE не настроен' })

    const orderId = uuidv4()
    const amount  = Math.round(parseFloat(cfg.price))

    const { data: fr } = await axios.post(`${FRIDE_API}/invoices/create`, {
      merchant_id:  FRIDE_MERCHANT_ID,
      amount,
      currency:     'RUB',
      order_id:     orderId,
      description:  cfg.label,
      success_url:  `${FRONT}/payment/success?plan=${plan}`,
      fail_url:     `${FRONT}/payment/fail`
    }, {
      headers: { 'X-Api-Key': FRIDE_API_KEY, 'Content-Type': 'application/json' }
    })

    await prisma.payment.create({
      data: {
        userId:        req.user.id,
        amount:        parseFloat(cfg.price),
        currency:      'RUB',
        status:        'PENDING',
        provider:      'fride',
        providerPayId: fr.invoice_id || orderId,
        plan:          'PRO',
        months:        cfg.months
      }
    })

    res.json({ success: true, data: { paymentUrl: fr.payment_url || fr.url, invoiceId: fr.invoice_id } })
  } catch (err) {
    console.error('FRIDE create:', err.response?.data || err.message)
    res.status(500).json({ success: false, error: 'Ошибка создания платежа FRIDE' })
  }
})

// ── POST /api/payments/fride-webhook ─────────────────────────────
router.post('/fride-webhook', async (req, res) => {
  try {
    const sig  = req.headers['x-fride-signature'] || req.headers['x-signature'] || ''
    const body = JSON.stringify(req.body)
    const expected = crypto.createHmac('sha256', FRIDE_WEBHOOK_KEY).update(body).digest('hex')
    if (sig && sig !== expected) {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    const { status, invoice_id, metadata } = req.body || {}
    if (!invoice_id) return res.status(400).json({ error: 'Bad payload' })

    if (status === 'paid' || status === 'succeeded') {
      const payment = await prisma.payment.findFirst({ where: { providerPayId: invoice_id } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } })

      const user = await prisma.user.findUnique({ where: { id: payment.userId } })
      const now  = new Date()
      const alreadyPro = user.plan === 'PRO' && user.planExpiresAt && user.planExpiresAt > now
      const base = alreadyPro ? user.planExpiresAt : now
      const exp  = new Date(base)
      exp.setMonth(exp.getMonth() + payment.months)

      await prisma.user.update({ where: { id: payment.userId }, data: { plan: 'PRO', planExpiresAt: exp } })
      console.log('FRIDE payment OK: user=' + payment.userId + ' PRO until ' + exp.toISOString())
    }

    if (status === 'cancelled' || status === 'failed') {
      await prisma.payment.updateMany({ where: { providerPayId: invoice_id }, data: { status: 'CANCELLED' } })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('FRIDE webhook error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

module.exports = router
