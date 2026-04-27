import re

path = '/var/www/centrio-api/prisma/schema.prisma'
with open(path, 'r') as f:
    schema = f.read()

if 'UsageStat' in schema:
    print('UsageStat already exists, skipping')
    exit(0)

# Add relation to User model
schema = schema.replace(
    '  sessions      Session[]',
    '  sessions      Session[]\n  usageStats    UsageStat[]'
)

# Add new model
usage_stat_model = '''
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
'''

schema = schema + usage_stat_model

with open(path, 'w') as f:
    f.write(schema)

print('Schema updated successfully')
