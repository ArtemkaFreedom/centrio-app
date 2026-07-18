const router  = require('express').Router()
const axios   = require('axios')
const crypto  = require('crypto')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const prisma  = require('../utils/prisma')
const { rateLimit } = require('../middleware/rateLimit')

// SECURITY: these routes had no rate limiting at all — an attacker could
// flood /create (DB-write + external payment-provider API amplification) or
// spam the webhook endpoints without any throttle.
const createPaymentLimiter = rateLimit({ name: 'payments-create',  windowMs: 5 * 60 * 1000, max: 10 })
const webhookLimiter       = rateLimit({ name: 'payments-webhook', windowMs: 60 * 1000,     max: 60 })

const YK_SHOP   = process.env.YUKASSA_SHOP_ID
const YK_SECRET = process.env.YUKASSA_SECRET_KEY
const YK_API    = 'https://api.yookassa.ru/v3'
const FRONT     = process.env.FRONTEND_URL || 'https://centrio.me'

// SECURITY: these previously had hardcoded plaintext fallback secrets
// (a real FRIDE API key, merchant ID, and webhook HMAC key), so even
// deployments that forgot to set the env vars — or anyone reading this
// source file — got a live, working set of production credentials.
// Now required from env only; FRIDE routes fail closed if unset (see
// the `if (!FRIDE_MERCHANT_ID)` / `if (!FRIDE_WEBHOOK_KEY)` checks below).
const FRIDE_API_KEY      = process.env.FRIDE_API_KEY
const FRIDE_MERCHANT_ID  = process.env.FRIDE_MERCHANT_ID
const FRIDE_WEBHOOK_KEY  = process.env.FRIDE_WEBHOOK_KEY
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
router.post('/create', createPaymentLimiter, authMiddleware, async (req, res) => {
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
router.post('/webhook', webhookLimiter, async (req, res) => {
  try {
    const { event, object: yk } = req.body || {}
    if (!yk?.id) return res.status(400).json({ error: 'Bad payload' })

    if (event === 'payment.succeeded') {
      const payment = await prisma.payment.findUnique({ where: { providerPayId: yk.id } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      // SECURITY: this endpoint had no authenticity check at all — no
      // signature, no IP allowlist. yk.id (the paymentId) is returned
      // directly to the authenticated user in /create's own response, so
      // any user could create a PENDING payment, never pay, then POST
      // { event: 'payment.succeeded', object: { id: <their own paymentId> } }
      // here and get Pro activated for free. Re-verify the real status
      // against YooKassa's API before trusting the webhook body, mirroring
      // the existing safe pattern already used in GET /status/:paymentId.
      const { data: ykStatus } = await axios.get(`${YK_API}/payments/${yk.id}`, { auth: ykAuth() })
      if (ykStatus.status !== 'succeeded') {
        console.warn(`[Webhook] payment ${yk.id} claims succeeded but YooKassa reports '${ykStatus.status}' — ignoring`)
        return res.status(409).json({ error: 'Status mismatch' })
      }

      // Idempotency: YooKassa retries webhook delivery. Without this,
      // a retried 'payment.succeeded' would extend the subscription again.
      if (payment.status === 'SUCCEEDED') {
        return res.json({ ok: true, alreadyProcessed: true })
      }

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
router.post('/fride-create', createPaymentLimiter, authMiddleware, async (req, res) => {
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

// ── POST /api/payments/crypto-activate ────────────────────────────
// Internal-only endpoint. The Next.js route handler at
// landing/api/crypto-webhook/route.ts has already verified the NOWPayments
// HMAC signature before calling this — it has no direct Prisma/DB access of
// its own, so it hops over here to actually persist the plan upgrade.
// Protected by a shared secret (never exposed to the browser) instead of
// authMiddleware, since this call is service-to-service, not user-initiated.
const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET
router.post('/crypto-activate', webhookLimiter, async (req, res) => {
  try {
    if (!INTERNAL_WEBHOOK_SECRET || req.headers['x-internal-secret'] !== INTERNAL_WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { userId, plan, providerPayId, amount, currency } = req.body || {}
    const cfg = PLANS[plan]
    if (!userId || !cfg) return res.status(400).json({ error: 'Bad payload' })

    // Idempotency: NOWPayments retries IPN callbacks on non-2xx / timeout.
    // Without this check a retried webhook would extend the subscription twice.
    if (providerPayId) {
      const existing = await prisma.payment.findFirst({
        where: { providerPayId, status: 'SUCCEEDED' }
      })
      if (existing) return res.json({ ok: true, alreadyProcessed: true })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const now = new Date()
    const alreadyPro = user.plan === 'PRO' && user.planExpiresAt && user.planExpiresAt > now
    const base = alreadyPro ? user.planExpiresAt : now
    const exp = new Date(base)
    exp.setMonth(exp.getMonth() + cfg.months)

    // Crypto payments are one-off (no saved payment method), unlike YooKassa
    // — do not set autoRenew here.
    await prisma.user.update({ where: { id: userId }, data: { plan: 'PRO', planExpiresAt: exp } })

    if (providerPayId) {
      await prisma.payment.create({
        data: {
          userId,
          amount:        parseFloat(amount) || 0,
          currency:      currency || 'USD',
          status:        'SUCCEEDED',
          provider:      'nowpayments',
          providerPayId: String(providerPayId),
          plan:          'PRO',
          months:        cfg.months
        }
      }).catch(err => console.error('crypto-activate: payment log insert failed:', err.message))
    }

    console.log('Crypto payment OK: user=' + userId + ' PRO until ' + exp.toISOString())
    res.json({ ok: true, expiresAt: exp })
  } catch (err) {
    console.error('crypto-activate error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── POST /api/payments/fride-webhook ─────────────────────────────
router.post('/fride-webhook', webhookLimiter, async (req, res) => {
  try {
    // SECURITY: `if (sig && sig !== expected)` skipped verification
    // entirely whenever the signature header was simply absent — an
    // attacker could POST { status: 'paid', invoice_id: '<any existing
    // pending invoice>' } with no signature at all and get Pro activated
    // for free. Fail closed instead: a configured secret and a valid,
    // timing-safe-compared signature are both mandatory.
    if (!FRIDE_WEBHOOK_KEY) {
      console.error('[FRIDE webhook] FRIDE_WEBHOOK_KEY not configured — rejecting request')
      return res.status(500).json({ error: 'Server misconfigured' })
    }
    const sig = req.headers['x-fride-signature'] || req.headers['x-signature'] || ''
    if (!sig) {
      console.warn('[FRIDE webhook] Missing signature header')
      return res.status(401).json({ error: 'Invalid signature' })
    }
    const body = JSON.stringify(req.body)
    const expected = crypto.createHmac('sha256', FRIDE_WEBHOOK_KEY).update(body).digest('hex')
    const sigBuf = Buffer.from(String(sig), 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const isValid = sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)
    if (!isValid) {
      console.warn('[FRIDE webhook] Invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const { status, invoice_id, metadata } = req.body || {}
    if (!invoice_id) return res.status(400).json({ error: 'Bad payload' })

    if (status === 'paid' || status === 'succeeded') {
      const payment = await prisma.payment.findFirst({ where: { providerPayId: invoice_id } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      // Idempotency: guard against duplicate webhook delivery re-extending
      // the subscription.
      if (payment.status === 'SUCCEEDED') {
        return res.json({ ok: true, alreadyProcessed: true })
      }

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
