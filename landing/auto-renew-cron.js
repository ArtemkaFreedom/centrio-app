// Cron-задача для автопродления подписок
// Запускается в src/cron/autoRenew.js на сервере

const cron = require('node-cron')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const prisma = require('../utils/prisma')

const YK_SHOP   = process.env.YUKASSA_SHOP_ID
const YK_SECRET = process.env.YUKASSA_SECRET_KEY
const YK_API    = 'https://api.yookassa.ru/v3'

function ykAuth () { return { username: YK_SHOP, password: YK_SECRET } }

async function runAutoRenew () {
  console.log('[AutoRenew] Checking subscriptions...')

  const now      = new Date()
  const deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // +3 дня

  // Найти PRO-пользователей у которых истекает через ≤3 дня и включено автопродление
  const users = await prisma.user.findMany({
    where: {
      plan:             'PRO',
      autoRenew:        true,
      autoRenewPayMethodId: { not: null },
      planExpiresAt:    { lte: deadline, gt: now }
    },
    select: {
      id: true, email: true, plan: true,
      planExpiresAt: true, autoRenewPayMethodId: true,
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { months: true, amount: true }
      }
    }
  })

  console.log('[AutoRenew] Found ' + users.length + ' subscriptions to renew')

  for (const user of users) {
    try {
      // Определяем период продления по последнему платежу (1 мес или 12 мес)
      const lastPayment = user.payments[0]
      const months  = lastPayment?.months || 1
      const amount  = months === 12 ? '1590.00' : '199.00'
      const label   = months === 12 ? 'Centrio Pro — 1 год (автопродление)' : 'Centrio Pro — 1 месяц (автопродление)'

      // Проверяем: не было ли уже попытки продления в последние 24 часа
      const recentLog = await prisma.autoRenewLog.findFirst({
        where: {
          userId:    user.id,
          createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      })
      if (recentLog) {
        console.log('[AutoRenew] Skipping ' + user.email + ' — already attempted in 24h')
        continue
      }

      const ikey = uuidv4()

      // Создаём платёж с сохранённым методом оплаты
      const { data: yk } = await axios.post(`${YK_API}/payments`, {
        amount:            { value: amount, currency: 'RUB' },
        capture:           true,
        description:       label,
        payment_method_id: user.autoRenewPayMethodId,
        metadata:          { userId: user.id, plan: 'PRO', months, autoRenew: true },
        receipt: {
          customer: { email: user.email },
          items: [{
            description:     label,
            quantity:        '1.00',
            amount:          { value: amount, currency: 'RUB' },
            vat_code:        1,
            payment_mode:    'full_payment',
            payment_subject: 'service'
          }]
        }
      }, {
        auth:    ykAuth(),
        headers: { 'Idempotence-Key': ikey }
      })

      // Запись в БД
      const payment = await prisma.payment.create({
        data: {
          userId:        user.id,
          amount:        parseFloat(amount),
          currency:      'RUB',
          status:        yk.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
          provider:      'yookassa',
          providerPayId: yk.id,
          plan:          'PRO',
          months
        }
      })

      await prisma.autoRenewLog.create({
        data: { userId: user.id, paymentId: payment.id, status: yk.status }
      })

      // Если сразу succeeded (при сохранённом методе обычно так)
      if (yk.status === 'succeeded') {
        const base = user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now
        const exp  = new Date(base)
        exp.setMonth(exp.getMonth() + months)
        await prisma.user.update({
          where: { id: user.id },
          data:  { plan: 'PRO', planExpiresAt: exp }
        })
        console.log('[AutoRenew] Renewed ' + user.email + ' until ' + exp.toISOString())
      } else {
        console.log('[AutoRenew] Payment created for ' + user.email + ' status=' + yk.status)
      }

    } catch (err) {
      console.error('[AutoRenew] Error for ' + user.email + ':', err.response?.data || err.message)
      await prisma.autoRenewLog.create({
        data: { userId: user.id, status: 'ERROR', error: String(err.message).slice(0, 200) }
      }).catch(() => {})
    }
  }

  // Понизить план истёкших PRO-пользователей без автопродления
  const expired = await prisma.user.updateMany({
    where: { plan: 'PRO', planExpiresAt: { lt: now } },
    data:  { plan: 'FREE', autoRenew: false }
  })
  if (expired.count > 0) {
    console.log('[AutoRenew] Downgraded ' + expired.count + ' expired PRO users to FREE')
  }
}

function startAutoRenewCron () {
  // Каждый день в 10:00 UTC
  cron.schedule('0 10 * * *', async () => {
    try { await runAutoRenew() }
    catch (e) { console.error('[AutoRenew] Cron error:', e.message) }
  })
  console.log('[AutoRenew] Cron scheduled: daily at 10:00 UTC')
}

module.exports = { startAutoRenewCron, runAutoRenew }
