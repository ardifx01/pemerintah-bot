#!/bin/bash

echo "🚀 Starting Pemerintah Bot on Railway..."

mkdir -p data
chmod 755 data

mkdir -p logs
chmod 755 logs

if [ -f "data/articles.db" ]; then
    chmod 644 data/articles.db
    echo "✅ Database file permissions set"
fi

echo "Node version: $(node --version)"
echo "Bun version: $(bun --version)"
echo "PORT: ${PORT:-3000}"
echo "NODE_ENV: ${NODE_ENV:-development}"

if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    echo "⚠️  WARNING: DISCORD_WEBHOOK_URL not set"
fi

echo "🔍 Testing database write permissions..."
touch data/test.tmp && rm data/test.tmp && echo "✅ Database directory writable" || echo "❌ Database directory not writable"

echo "🤖 Launching bot..."
exec bun run src/index.ts 