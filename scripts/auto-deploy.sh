#!/usr/bin/env bash
# Automated Deployment Script for Signal Generator Server (sg.quotewear.store)
set -e

APP_DIR="/usr/src/app"
if [ ! -d "$APP_DIR" ]; then
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

cd "$APP_DIR"

git fetch origin main > /dev/null 2>&1 || true

LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != "unknown" ]; then
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] 🚀 Auto-Deployer: New commit detected ($REMOTE). Pulling updates..."
  git pull origin main
  if [ -f "package.json" ]; then
    npm run build:client > /dev/null 2>&1 || true
  fi
  if command -v docker > /dev/null 2>&1 && [ -f "docker-compose.yml" ]; then
    docker compose restart app > /dev/null 2>&1 || true
  fi
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ✅ Auto-Deployer: Deployment complete for commit $REMOTE."
else
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ℹ️ Auto-Deployer: Up to date ($LOCAL)."
fi
