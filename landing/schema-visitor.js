// Adds Visitor model to Prisma schema
// Run on server: node /tmp/schema_visitor.js
const fs = require('fs')
const path = '/var/www/centrio-api/prisma/schema.prisma'
let schema = fs.readFileSync(path, 'utf8')

const visitorModel = `
model Visitor {
  id              String   @id @default(uuid())
  visitorId       String   @unique
  platform        String?
  appVersion      String?
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
  sessions        Int      @default(1)
  messengersCount Int      @default(0)

  @@index([lastSeenAt])
}
`

if (schema.includes('model Visitor')) {
  console.log('Visitor model already exists — nothing to do.')
  process.exit(0)
}

schema += visitorModel
fs.writeFileSync(path, schema)
console.log('Visitor model added to schema.prisma')
