# Plan: Nix Flake for Local PostgreSQL (Supabase-compatible)

## Context

SupabaseのDB機能のみを使用しているため、SupabaseのDocker構成ではなく、Nix flakeで直接PostgreSQLを立ち上げ、チームと共有できるようにする。

## Requirements

- PostgreSQL 15.x (Supabaseの15.14に近い)
- RLS有効 (`row_security = on`)
- Supabase互換のロール: `authenticated`, `anon`
- `requesting_user_id()` 関数 (マイグレーションで作成済み)
- `set_config` / `current_setting` によるJWT claims設定

## Implementation

### 1. `flake.nix` 作成

Supabase CLI風のコマンドを提供:

- `nix run .#db-start` - PostgreSQL起動
- `nix run .#db-stop` - PostgreSQL停止
- `nix run .#db-reset` - データベースリセット

データは `.data/postgres` に永続化。

### 2. PostgreSQL設定 (`nix/postgresql.conf`)

Supabase互換の主要設定:

```
row_security = on
wal_level = logical
password_encryption = scram-sha-256
timezone = UTC
listen_addresses = 'localhost'
port = 54322  # Supabase CLIと同じポート
```

### 3. 初期化SQL (`nix/init.sql`)

```sql
-- Supabase互換ロール
CREATE ROLE authenticated NOINHERIT;
CREATE ROLE anon NOINHERIT;

-- requesting_user_id関数
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text LANGUAGE sql STABLE
RETURNS NULL ON NULL INPUT
SET search_path = pg_catalog
AS $$
    SELECT NULLIF(
        current_setting('request.jwt.claims', true)::json->>'sub',
        ''
    )::text;
$$;
```

### 4. 環境変数 (`.env`)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DATABASE_DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## Files to Create

| File                  | Purpose                  |
| --------------------- | ------------------------ |
| `flake.nix`           | Nix flake定義            |
| `flake.lock`          | 依存関係ロック           |
| `nix/postgresql.conf` | PostgreSQL設定           |
| `nix/init.sql`        | 初期化SQL (ロール・関数) |
| `.envrc`              | direnv設定 (オプション)  |

## Usage

```bash
# PostgreSQL起動
nix run .#db-start

# マイグレーション実行
cd apps/api && bun run db:migrate

# 開発サーバー起動
bun run dev

# PostgreSQL停止
nix run .#db-stop
```

## Verification

1. `nix run .#db-start` でPostgreSQL起動
2. `psql -h localhost -p 54322 -U postgres -c "SELECT * FROM pg_roles WHERE rolname IN ('authenticated', 'anon');"` でロール確認
3. `cd apps/api && bun run db:migrate` でマイグレーション成功
4. `bun run dev` でアプリ起動
5. 認証フローでRLSポリシーが正しく動作することを確認
