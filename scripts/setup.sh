#!/bin/bash
# One-command project setup for TemptX — used locally and by Claude cloud sessions
# (via the SessionStart hook in .claude/settings.json). Safe to run repeatedly.
set -e
cd "$(dirname "$0")/.."

# Install dependencies only if they're missing (keeps session start fast).
if [ ! -d node_modules/dotenv ]; then
  PUPPETEER_SKIP_DOWNLOAD="${PUPPETEER_SKIP_DOWNLOAD:-1}" npm ci --no-audit --no-fund
fi

# Create a local .env from the template the first time (never overwrites).
[ -f .env ] || cp .env.example .env

# The server requires DATABASE_URL (lib/db.js) and won't boot without it.
if ! grep -q '^DATABASE_URL=.\+' .env 2>/dev/null; then
  echo "NOTE: DATABASE_URL is not set in .env — add a Postgres connection string before running 'npm start'. See .env.example."
fi
