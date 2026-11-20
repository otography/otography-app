set shell := ["bash", "-euo", "pipefail", "-c"]

db_file := "local.db"
db_port := "8080"
db_url := "http://127.0.0.1:" + db_port

# レシピ一覧を表示
default:
    @just --list

# ローカル DB → マイグレーション → API・フロントエンドを一括起動
dev:
    #!/usr/bin/env bash
    set -euo pipefail

    for cmd in turso vp; do
      if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "エラー: '$cmd' が見つかりません。インストールしてから再実行してください。" >&2
        exit 1
      fi
    done

    if [ ! -f "apps/api/.env" ]; then
      echo "警告: apps/api/.env が見つかりません。'cp apps/api/.env.example apps/api/.env' を実行して設定してください。" >&2
    fi

    pids=()

    kill_tree() {
      local pid="$1"
      local child
      for child in $(pgrep -P "$pid" 2>/dev/null || true); do
        kill_tree "$child"
      done
      kill -TERM "$pid" 2>/dev/null || true
    }

    cleanup() {
      trap - INT TERM EXIT
      if [ "${#pids[@]}" -gt 0 ]; then
        echo ""
        echo "停止中..."
        for pid in "${pids[@]}"; do
          if kill -0 "$pid" 2>/dev/null; then
            kill_tree "$pid"
          fi
        done
        wait 2>/dev/null || true
      fi
    }

    on_signal() {
      cleanup
      exit 0
    }

    trap on_signal INT TERM
    trap cleanup EXIT

    echo "[db] turso dev を起動中 ({{db_url}})..."
    turso dev --db-file "{{db_file}}" &
    db_pid=$!
    pids+=("$db_pid")

    ready=0
    for _ in $(seq 1 75); do
      if nc -z 127.0.0.1 "{{db_port}}" 2>/dev/null; then
        ready=1
        break
      fi
      if ! kill -0 "$db_pid" 2>/dev/null; then
        echo "エラー: turso dev の起動に失敗しました。" >&2
        exit 1
      fi
      sleep 0.2
    done

    if [ "$ready" -ne 1 ]; then
      echo "エラー: ローカル DB ({{db_url}}) の起動待機がタイムアウトしました。" >&2
      exit 1
    fi

    echo "[db] マイグレーションを適用中..."
    TURSO_DATABASE_URL="{{db_url}}" TURSO_AUTH_TOKEN="" vp run db#db:migrate

    echo "[api] バックエンドを起動中 (http://localhost:8787)..."
    vp run api#dev &
    pids+=("$!")

    echo "[web] フロントエンドを起動中 (http://localhost:3000)..."
    vp run website#dev &
    pids+=("$!")

    wait

# ローカル DB のみ起動
db:
    turso dev --db-file "{{db_file}}"

# ローカル DB にマイグレーションを適用
db-migrate:
    TURSO_DATABASE_URL="{{db_url}}" TURSO_AUTH_TOKEN="" vp run db#db:migrate

# ローカル DB にダミーデータを投入
db-seed:
    TURSO_DATABASE_URL="{{db_url}}" TURSO_AUTH_TOKEN="" vp run db#db:seed

# API のみ起動
api:
    vp run api#dev

# フロントエンドのみ起動
web:
    vp run website#dev
