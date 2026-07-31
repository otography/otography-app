# MUS-31: Apple Music API の timeout / 429 handling

## Context

`apps/api/src/shared/apple-music/client.ts` のカタログ取得は timeout を指定していないため、
Apple Music API が応答しないと Worker の処理が長時間残る。また upstream の 429 を他の
失敗と同じ 502 に変換しており、クライアントが再試行時刻を判断できない。

## Decisions

- `fetchCatalogResource` の `fetch` に `AbortSignal.timeout(5000)` を渡し、artist / song の
  両方へ同じ deadline を適用する。
- upstream 429 は専用の `AppleMusicRateLimitError` に変換し、HTTP status は 503 とする。
- upstream の `Retry-After` がある場合はエラー値に保持し、API 応答の `Retry-After`
  ヘッダーへそのまま伝播する。値が無い場合は推測値を作らない。
- 既存の 404 → 404、その他 upstream failure → 502 の契約は維持する。

## Test list (t-wada TDD)

1. `fetchArtist` / `fetchSong` が 5000ms の timeout signal を `fetch` に渡す。
2. upstream 429 + `Retry-After` を専用エラー（503 + retryAfter）へ変換する。
3. artist 作成 API が専用エラーを 503 Problem Details + `Retry-After` ヘッダーで返す。
4. upstream 429 に `Retry-After` が無い場合は 503 を返し、レスポンスヘッダーを付けない。
5. 既存の client / route / error tests が回帰なく通る。

## Verification

```bash
bun run test --filter=api -- src/__tests__/shared/apple-music/client.test.ts
bun run test --filter=api -- src/__tests__/features/artists/route.test.ts
bun run test --filter=api
bun run test --filter=@repo/errors
bun run check-types
bun run lint
```
