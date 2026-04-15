#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
PM2_APP_NAME="${PM2_APP_NAME:-dogen}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.production}"

cd "$PROJECT_DIR"

echo "==> Deploying Dogen Capital"
echo "==> Project: $PROJECT_DIR"
echo "==> Branch: $BRANCH"
echo "==> PM2 app: $PM2_APP_NAME"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found in $PROJECT_DIR" >&2
  exit 1
fi

echo "==> Pulling latest code"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Installing dependencies, including build-time dev dependencies"
npm install --include=dev

echo "==> Loading environment from $ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set after loading $ENV_FILE" >&2
  exit 1
fi

echo "==> Updating Prisma client and database schema"
npm run db:generate
npm run db:push

echo "==> Building production bundle"
npm run build

echo "==> Restarting PM2 app"
pm2 restart "$PM2_APP_NAME" --update-env

echo "==> PM2 status"
pm2 status "$PM2_APP_NAME"

echo "==> Recent logs"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream

echo "==> Deploy complete"
