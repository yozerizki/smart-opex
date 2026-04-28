#!/bin/sh
set -eu

cd /app

echo "Running prisma migrate deploy..."
npx prisma migrate deploy

SEED_ACTION=$(node <<'NODE'
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const requiredUsers = ['verifikator@smartopex.local', 'pusat@smartopex.local']
  const count = await prisma.users.count({
    where: {
      email: {
        in: requiredUsers,
      },
    },
  })

  process.stdout.write(count >= requiredUsers.length ? 'skip' : 'seed')
}

main()
  .catch(() => process.stdout.write('seed'))
  .finally(async () => {
    await prisma.$disconnect()
  })
NODE
)

if [ "$SEED_ACTION" = "seed" ]; then
  echo "Seeding initial data (group view, region, area, users)..."
  npx prisma db seed
else
  echo "Core users already exist, skipping seed."
fi

exec npm run start:dev
