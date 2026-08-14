#!/usr/bin/env bash
# Тесты идут по отдельной базе, чтобы не трогать dev.db разработчика.
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL="postgresql://buildhub:buildhub@127.0.0.1:5432/buildhub_test?schema=public"
export JWT_SECRET="test-secret"
export LOG_LEVEL="silent"
npx prisma db push --skip-generate --accept-data-loss >/dev/null
# Файлы идут по очереди: база одна, и параллельный пересев ломал бы соседей.
node --import tsx --test --test-concurrency=1 "tests/*.test.ts"
