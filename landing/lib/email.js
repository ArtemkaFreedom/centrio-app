// Shared email helper used across payments/auto-renew/GDPR flows.
//
// Deliberately uses Resend's plain HTTP API via axios instead of the
// `resend` npm package: axios is already a runtime dependency of
// centrio-api (see payments-server.js), so this needs zero new
// `npm install` on the server — the deploy scripts only push files over
// SFTP, they don't run package installs.
//
// Fails soft everywhere: if RESEND_API_KEY isn't configured, or the send
// fails, callers get `{ ok: false }` and a console warning instead of an
// exception — a broken email provider must never break a payment webhook
// or the auto-renew cron.
const axios = require('axios')

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS    = process.env.EMAIL_FROM || 'Centrio <noreply@centrio.me>'
const RESEND_API      = 'https://api.resend.com/emails'

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not configured — skipping email "${subject}" to ${to}`)
    return { ok: false, reason: 'not_configured' }
  }
  if (!to) {
    console.warn(`[email] Missing recipient — skipping email "${subject}"`)
    return { ok: false, reason: 'no_recipient' }
  }
  try {
    await axios.post(RESEND_API, { from: FROM_ADDRESS, to, subject, html }, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 10000
    })
    return { ok: true }
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err.response?.data || err.message)
    return { ok: false, reason: 'send_failed' }
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

async function sendPaymentReceiptEmail(user, payment) {
  if (!user?.email) return { ok: false, reason: 'no_recipient' }
  const amountLabel = `${payment.amount} ${payment.currency}`
  const planLabel    = payment.months === 12 ? '1 год' : `${payment.months} мес.`
  return sendEmail({
    to: user.email,
    subject: 'Оплата Centrio Pro прошла успешно',
    html: `
      <p>Здравствуйте${user.name ? ', ' + escapeHtml(user.name) : ''}!</p>
      <p>Ваш платёж на сумму <strong>${escapeHtml(amountLabel)}</strong> (${escapeHtml(planLabel)}) прошёл успешно.</p>
      <p>Centrio Pro активирован. Спасибо, что вы с нами!</p>
      <p style="color:#888;font-size:12px">Если это были не вы — напишите на support@centrio.me</p>
    `
  })
}

async function sendAutoRenewFailedEmail(user, reason) {
  if (!user?.email) return { ok: false, reason: 'no_recipient' }
  return sendEmail({
    to: user.email,
    subject: 'Не удалось продлить подписку Centrio Pro',
    html: `
      <p>Здравствуйте${user.name ? ', ' + escapeHtml(user.name) : ''}!</p>
      <p>Попытка автоматического продления подписки Centrio Pro не удалась.</p>
      <p>Чтобы не потерять доступ к Pro-функциям, продлите подписку вручную в личном кабинете
      или обновите способ оплаты.</p>
      <p style="color:#888;font-size:12px">Техническая причина: ${escapeHtml(reason || 'неизвестно')}</p>
    `
  })
}

async function sendRefundConfirmationEmail(user, payment) {
  if (!user?.email) return { ok: false, reason: 'no_recipient' }
  return sendEmail({
    to: user.email,
    subject: 'Возврат средств оформлен',
    html: `
      <p>Здравствуйте${user.name ? ', ' + escapeHtml(user.name) : ''}!</p>
      <p>Возврат по платежу на сумму <strong>${escapeHtml(payment.amount + ' ' + payment.currency)}</strong> оформлен.
      Средства поступят на ваш счёт в течение нескольких рабочих дней (сроки зависят от банка).</p>
    `
  })
}

module.exports = { sendEmail, sendPaymentReceiptEmail, sendAutoRenewFailedEmail, sendRefundConfirmationEmail }
