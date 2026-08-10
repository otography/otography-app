# 06 — shared/auth SRPレビュー

**対象ファイル**（12ファイル）:

- `auth-session.ts`, `cookies.ts`, `envelope.ts`, `key-ring-loader.ts`, `key-ring.ts`
- `oauth-state.ts`, `opaque-cookie.ts`, `session-config.ts`, `session-crypto.ts`
- `session-model.ts`, `session-repository.ts`, `session-service.ts`

## 結果サマリー

| ファイル              | SRP | 合成性 |
| --------------------- | --- | ------ |
| auth-session.ts       | ✅  | ✅     |
| cookies.ts            | ✅  | ✅     |
| envelope.ts           | ✅  | ✅     |
| key-ring-loader.ts    | ✅  | ✅     |
| key-ring.ts           | ✅  | ✅     |
| oauth-state.ts        | ✅  | ✅     |
| opaque-cookie.ts      | ✅  | ✅     |
| session-config.ts     | ✅  | ✅     |
| session-crypto.ts     | ✅  | ✅     |
| session-model.ts      | ✅  | ✅     |
| session-repository.ts | ⚠️  | ✅     |
| session-service.ts    | ⚠️  | ✅     |

**総評**: 12ファイル中9ファイルが完全適合。モジュール構成は概ねSRPに準拠しており、各ファイルが明確な名前通りの責務を持つ。

## 横断的所見

### 重複コード

1. **`bytesToHex` 関数**: 3ファイルで重複定義
   - `envelope.ts` 行66-69
   - `key-ring-loader.ts` 行51-54
   - `session-crypto.ts` 行48-51（インライン展開）

   **推奨**: `shared/auth/hex-utils.ts`（新規）に `bytesToHex` / `hexToBytes` を集約。

2. **`OAUTH_NONCE_COOKIE_NAME`**: 2ファイルで重複
   - `cookies.ts` 行7
   - `oauth-state.ts` 行14

   **推奨**: `cookies.ts` を正とし、`oauth-state.ts` は import する。

### 動的import の不適切な使用

- `session-service.ts` 行97, 109, 169 で `await import("./session-crypto")` を使用。同一パッケージ内の静的依存なら top-level import で十分。コード分割の意図が不明。

---

## 詳細（問題のあるファイルのみ）

### `session-repository.ts` ⚠️

**責務**: サーバーセッションの永続化（CRUD）。作成・取得・更新・無効化・タイムスタンプ計算・行変換。

**問題点**:

1. **`rowToSession`（行285-326）がエンベロープの kid 整合性検証を実施**: ビジネスルール検証がリポジトリの責務（行↔エンティティの変換）を超えている。

2. **`computeTimestamps`（行38-45）**: ポリシー計算（`session-config.ts` の定数に依存）がリポジトリ内に埋め込まれている。

**推奨**:

- `rowToSession` の kid 整合性チェックを `session-service.ts` または専用のドメインバリデータに移動
- `computeTimestamps` は `session-config.ts` または別ファクトリに抽出を検討
- ただし、リポジトリが戻り値の型保証のために `validateEnvelope` を呼ぶのは妥当な範囲（DB信頼境界の検証）

---

### `session-service.ts` ⚠️

**責務**: セッションの発行（`issueSession`）、検証付き解決（`resolveSession`）、Firebase リフレッシュ、CAS競合回復、遅延/バッチ再暗号化。

**問題点**:

1. **動的import の不適切な使用**（行97, 109, 169）:

   ```ts
   await import("./session-crypto");
   ```

   `generateOpaqueSessionId` と `hashSessionId` を毎回動的ロード。依存関係が不明瞭で、パフォーマンス上も無意味（同一モジュール内）。

2. **ファイルサイズ**: 約430行 / 16KB。5つの主要操作（issue/resolve/refresh/recover/re-encrypt）を含む。特に:
   - `lazyReEncrypt`（行295-336）
   - `batchReEncrypt`（行344-413）
     これらは「再暗号化」という別責務に近い。

3. **エラー処理ヘルパー**（行89-95）: `terminalSessionError` と `safeRevokeSession` はサービスの核心ロジックではなく抽出可能。

**推奨**:

1. 動的 `import("./session-crypto")` をファイル先頭の静的 import に置換（行97, 109, 169）
2. `lazyReEncrypt` と `batchReEncrypt` を `session-re-encrypt.ts` のような別ファイルに切り出し
3. `safeRevokeSession` と `terminalSessionError` を `session-errors.ts` に抽出し再利用性を向上
