#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

build_web() {
  bun run --cwd "$repo_root/apps/web" build
}

if [[ "${VERCEL_ENV:-}" != "preview" || -z "${VERCEL_GIT_PULL_REQUEST_ID:-}" ]]; then
  build_web
  exit 0
fi

required_preview_env=(
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_WORKERS_SUBDOMAIN
  VERCEL_URL
)

for name in "${required_preview_env[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "${name} is required for PR preview builds." >&2
    exit 1
  fi
done

worker_name="api-preview"
api_alias="pr-${VERCEL_GIT_PULL_REQUEST_ID}"
api_url="https://${api_alias}-${worker_name}.${CLOUDFLARE_WORKERS_SUBDOMAIN}.workers.dev"
web_url="https://${VERCEL_URL}"

bunx wrangler versions upload \
  --cwd "$repo_root/apps/api" \
  --env preview \
  --preview-alias "$api_alias" \
  --message "PR #${VERCEL_GIT_PULL_REQUEST_ID} preview" \
  --var "APP_FRONTEND_URL:${web_url}" \
  --var "AUTH_COOKIE_DOMAIN:" \
  --var "GOOGLE_OAUTH_REDIRECT_URI:${web_url}/api/auth/google/callback"

NEXT_PUBLIC_API_URL="$api_url" build_web
