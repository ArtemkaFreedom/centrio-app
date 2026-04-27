// This script appends UsageStat model to the existing schema
// Run via: node /tmp/schema_add.js
const fs = require('fs')
const path = '/var/www/centrio-api/prisma/schema.prisma'
let schema = fs.readFileSync(path, 'utf8')

const usageStatModel = `
model UsageStat {
  id          String   @id @default(uuid())
  userId      String
  date        DateTime @default(now())
  service     String?
  appTime     Int      @default(0)
  serviceTime Int      @default(0)
  notifCount  Int      @default(0)
  msgSent     Int      @default(0)
  msgReceived Int      @default(0)

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, date])
}
`

// Add relation to User model
if (!schema.includes('UsageStat')) {
  schema = schema.replace(
    'sessions      Session[]',
    'sessions      Session[]\n  usageStats    UsageStat[]'
  )
  schema += usageStatModel
  fs.writeFileSync(path, schema)
  console.log('Schema updated successfully')
} else {
  console.log('UsageStat already exists')
}
