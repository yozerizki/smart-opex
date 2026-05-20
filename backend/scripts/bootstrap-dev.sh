#!/bin/sh
set -eu

cd /app

echo "Running prisma migrate deploy..."
npx prisma migrate deploy

exec npm run start:dev
