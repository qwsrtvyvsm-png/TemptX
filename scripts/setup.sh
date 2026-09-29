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
