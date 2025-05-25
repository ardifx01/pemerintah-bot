#!/bin/bash

echo "🚀 Starting Pemerintah Bot on Railway..."

mkdir -p data

chmod 755 data

echo "Node version: $(node --version)"
echo "Bun version: $(bun --version)"
echo "PORT: ${PORT:-3000}"
echo "NODE_ENV: ${NODE_ENV:-development}"

echo "🤖 Launching bot..."
exec bun run src/index.ts 