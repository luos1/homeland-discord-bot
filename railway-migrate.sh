#!/bin/bash
# Railway Prisma Migration Script

echo "🚀 Running Prisma migrations on Railway..."

# Railway DATABASE_URL 필요
if [ -z "$RAILWAY_DATABASE_URL" ]; then
  echo "❌ RAILWAY_DATABASE_URL not set"
  echo "Please set it from Railway dashboard:"
  echo "Settings > Variables > Copy PostgreSQL DATABASE_URL"
  exit 1
fi

# Prisma migrate
export DATABASE_URL="$RAILWAY_DATABASE_URL"
npx prisma db push --accept-data-loss

echo "✅ Migration complete!"
