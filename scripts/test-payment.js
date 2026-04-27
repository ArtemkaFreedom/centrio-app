// Run this on the server to test YooKassa payment creation with receipt
const axios = require('/var/www/centrio-api/node_modules/axios')
require('/var/www/centrio-api/node_modules/dotenv').config({ path: '/var/www/centrio-api/.env' })

const SHOP   = process.env.YUKASSA_SHOP_ID
const SECRET = process.env.YUKASSA_SECRET_KEY

console.log('Shop ID:', SHOP)
console.log('Secret starts with:', SECRET?.slice(0, 8))

axios.post('https://api.yookassa.ru/v3/payments', {
  amount:       { value: '199.00', currency: 'RUB' },
  confirmation: { type: 'redirect', return_url: 'https://centrio.me/payment/success?plan=month' },
  capture:      true,
  description:  'Centrio Pro — 1 месяц',
  metadata:     { userId: 'test-001', plan: 'month', months: 1 },
  receipt: {
    customer: { email: 'test@centrio.me' },
    items: [{
      description:     'Centrio Pro — 1 месяц',
      quantity:        '1.00',
      amount:          { value: '199.00', currency: 'RUB' },
      vat_code:        1,
      payment_mode:    'full_payment',
      payment_subject: 'service'
    }]
  }
}, {
  auth:    { username: SHOP, password: SECRET },
  headers: { 'Idempotence-Key': 'test-receipt-centrio-' + Date.now() }
}).then(r => {
  console.log('\n✅ Payment created!')
  console.log('ID:', r.data.id)
  console.log('Status:', r.data.status)
  console.log('URL:', r.data.confirmation?.confirmation_url)
}).catch(e => {
  console.error('\n❌ Error:', JSON.stringify(e.response?.data || e.message, null, 2))
})
