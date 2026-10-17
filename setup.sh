#!/usr/bin/env bash

set -e

echo "🚀 Starting full project setup..."

# -----------------------------------------
# 1. Ensure .env exists
# -----------------------------------------
if [ ! -f ".env" ]; then
  echo "⚠️ .env not found. Creating from example.env..."
  cp example.env .env
  echo "✅ .env created from example.env"
  echo "👉 Please fill in real values before continuing."
fi

# -----------------------------------------
# 2. Validate environment variables dynamically
# -----------------------------------------
echo "🔍 Validating .env values..."

if [ ! -f "example.env" ]; then
  echo "❌ example.env not found. Cannot validate environment."
  exit 1
fi

MISSING=false

while IFS= read -r line; do
  # Skip comments and empty lines
  if [[ -z "$line" || "$line" == \#* ]]; then
    continue
  fi

  KEY=$(echo "$line" | cut -d '=' -f1)

  # Get value from .env
  VALUE=$(grep "^${KEY}=" .env | cut -d '=' -f2-)

  if [ -z "$VALUE" ] || [[ "$VALUE" == "XXXX" ]]; then
    echo "❌ Invalid or missing value for: $KEY"
    MISSING=true
  fi

done <example.env

if [ "$MISSING" = true ]; then
  echo ""
  echo "❌ Environment validation failed."
  echo "👉 Please update .env and replace all 'XXXX' values before running setup again."
  exit 1
fi

echo "✅ Environment variables are valid!"

# -----------------------------------------
# 3. Install dependencies
# -----------------------------------------
echo "📦 Installing dependencies..."
rm -rf node_modules
pnpm install

# -----------------------------------------
# 4. Start database
# -----------------------------------------
echo "🗄️ Starting database..."
pnpm run db:setup
pnpm run db:start

echo "⏳ Waiting for database to initialize..."
sleep 10

# -----------------------------------------
# 5. Prisma generate
# -----------------------------------------
echo "⚙️ Generating Prisma client..."
pnpm run prisma:generate

# -----------------------------------------
# 6. Prisma migrate
# -----------------------------------------
echo "🧱 Running Prisma migrations..."
pnpm run prisma:migrate -- init

# -----------------------------------------
# 7. Seed database
# -----------------------------------------
echo "🌱 Seeding database..."
pnpm run prisma:seed

# -----------------------------------------
# 8. Start development server
# -----------------------------------------
echo "🔥 Starting development server..."
pnpm run dev
