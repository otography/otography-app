# API (Hono + PostgreSQL + Firebase Auth)

Cloudflare Workers 上で動作する Hono API です。ブラウザにはランダムなオペーク
セッションIDだけを Cookie として渡し、Firebase のセッションクレデンシャルと
リフレッシュトークンは PostgreSQL の `server_sessions` に AES-256-GCM で暗号化して
保存します。

## ローカルセットアップ

`apps/api/.dev.vars.example` を `.dev.vars` にコピーし、Firebase、Database、OAuth、
`AUTH_SESSION_KEY_RING` を設定します。キーは次のコマンドで生成できます。

```bash
openssl rand -hex 32
```

キーリングの形式は次のとおりです。`activeKeyId` は暗号化に使うキー、
`decryptOnly` は過去データの復号だけを許すキーです。

```json
{
  "v": 1,
  "activeKeyId": "2026-07",
  "keys": [
    { "id": "2026-07", "hex": "64文字のhex" },
    { "id": "2026-04", "hex": "64文字のhex", "decryptOnly": true }
  ]
}
```

```bash
bun install
bun run dev --filter=api
```

## 本番の鍵管理

本番では `AUTH_SESSION_KEY_RING` を Cloudflare Secrets Store の
`SecretsStoreSecret` バインディングとして設定します。ローカルとテストでは同名の
文字列を使用します。

Secrets Store は外部KMSではありません。Worker は `.get()` によってキーリングの
平文を取得し、Web Crypto が Worker 内で AES-GCM を実行します。Worker に鍵素材を
渡さず暗号処理だけを外部サービスへ委譲する要件がある場合は、Cloud KMS/HSM の
Encrypt/Decrypt API を呼ぶ別設計が必要です。

### 鍵ローテーション手順

1. 新しい32バイト鍵を追加し、新しいIDを `activeKeyId` にする。
2. 旧キーを `decryptOnly: true` のまま残して Secrets Store を更新する。
3. 通常アクセス時の遅延再暗号化、または `batchReEncrypt` を反復実行する。
4. `countRemainingByKey` が0であることを確認する。
5. 旧キーをキーリングから削除する。

旧キーを先に削除すると残存セッションを復号できません。キーリング値は毎回再取得し、
内容のSHA-256が変わった場合だけ `CryptoKey` キャッシュを再構築します。

## セッション方針

- Cookie: 本番は `__Host-otography_session`、開発は `otography_session`
- 属性: `HttpOnly`, `SameSite=Strict`, `Path=/`, 本番のみ `Secure`、`Domain` なし
- idle timeout: 5日
- absolute timeout: 14日（延長不可）
- サインアウト: 現在のデバイスのサーバーセッションだけを失効
- アカウント削除: 全サーバーセッションと Firebase トークンを失効してから論理削除

## 検証とDBコマンド

```bash
bun run test --filter=api
just db-start
bun run test:db --filter=api
bun run check-types --filter=api
bun run lint --filter=api

cd apps/api
bun run db:generate
bun run db:migrate
```
