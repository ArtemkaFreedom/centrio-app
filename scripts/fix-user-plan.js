// Fix user plan expiry: set to 1 month from actual payment date (April 24, 2026)
require('/var/www/centrio-api/node_modules/dotenv').config({ path: '/var/www/centrio-api/.env' })
const { PrismaClient } = require('/var/www/centrio-api/node_modules/@prisma/client')

const prisma = new PrismaClient()

const USER_ID = '9ac42dda-4fad-4797-b66d-506d74b9e4d2'

// April 24 2026 + 1 month = May 24 2026
const correctExpiry = new Date('2026-05-24T00:00:00.000Z')

async function fix() {
    const before = await prisma.user.findUnique({ where: { id: USER_ID }, select: { email: true, plan: true, planExpiresAt: true } })
    console.log('Before:', before)

    await prisma.user.update({
        where: { id: USER_ID },
        data: { plan: 'PRO', planExpiresAt: correctExpiry }
    })

    const after = await prisma.user.findUnique({ where: { id: USER_ID }, select: { email: true, plan: true, planExpiresAt: true } })
    console.log('After:', after)
    await prisma.$disconnect()
}

fix().catch(e => { console.error(e); process.exit(1) })
