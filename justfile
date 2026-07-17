set positional-arguments

# デフォルト: ヘルプを表示
default:
    just --list

# git pull
pull:
    git pull

# ローカルPostgreSQLを起動
db-start:
    nix run .#db-start

# ローカルPostgreSQLを停止
db-stop:
    nix run .#db-stop

# ローカルPostgreSQLをリセット (データ全削除)
db-reset:
    nix run .#db-reset

# psqlでローカルPostgreSQLに接続
db-psql *args="":
    nix run .#db-psql -- {{args}}

# マイグレーションを生成
db-generate:
    cd apps/api && bun run db:generate

# マイグレーションを適用
db-migrate:
    cd apps/api && bun run db:migrate

# スキーマを直接push
db-push:
    cd apps/api && bun run db:push

# Drizzle Studioを起動
db-studio:
    cd apps/api && bun run db:studio

# データベースセキュリティlint (Supabase linter互換)
db-lint:
    nix run .#db-psql -- -f scripts/db-lint.sql

# マイグレーションを生成・適用してから両方立ち上げ
dev: db-generate db-migrate
    bun run dev

# 外出先プレビュー用: web をスマホ/Tailscale/ngrok から見えるように立ち上げる
dev-away: db-generate db-migrate
    bun run dev --filter=api & cd apps/web && bun run dev -- --hostname 0.0.0.0

# APIのみ
api:
    cd apps/api && bun run dev

# webのみ
web:
    bun run dev --filter=web

# 外出先プレビュー用: webのみを外部接続許可で起動
web-away:
    cd apps/web && bun run dev -- --hostname 0.0.0.0

# 外出先プレビュー用: web の ngrok URLを発行
ngrok:
    ngrok http 3000

# セットアップ: pull -> install -> db-start -> db-migrate -> dev
setup:
    just pull
    bun install
    just db-start
    just db-migrate
    just dev
