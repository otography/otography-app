set positional-arguments

# デフォルト: ヘルプを表示
default:
    just --list

# git pull
pull:
    git pull

# ローカルPostgreSQLを起動
db-start:
    nix run .#db:start

# ローカルPostgreSQLを停止
db-stop:
    nix run .#db:stop

# ローカルPostgreSQLをリセット (データ全削除)
db-reset:
    nix run .#db:reset

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

# 両方立ち上げ
dev:
    bun run dev

# APIのみ
api:
    cd apps/api && bun run dev

# webのみ
web:
    bun run dev --filter=web

# セットアップ: pull -> install -> db:start -> db:migrate -> dev
setup:
    just pull
    bun install
    just db-start
    just db-migrate
    just dev
