# MUS-26 認可設計修正: カタログ書き込みの同期専用化

## Context

[MUS-26](https://linear.app/music-social/issue/MUS-26) (Urgent): 任意のログインユーザーがカタログを破壊できる。

- `PATCH /api/artists/:id` は自由記述ボディで任意のアーティストを書き換え可能、`DELETE /api/artists/:id` で任意のアーティストを論理削除可能。ゲートは `requireAuthMiddleware()` のみ。
- さらに artists の usecase は素の `db`(postgres スーパーユーザー)で書き込むため **RLS を完全にバイパス**している(songs は `withAuthenticatedRole` 経由だがポリシーが `using: true / withCheck: true` で無意味)。
- web アプリはこれらのエンドポイントを呼んでいない(削除しても壊れない)。

**採用方針(ユーザー確認済み): 同期専用化。** カタログへの書き込みをすべて Apple Music 由来の値に限定し、「任意のカタログ書き込み」という操作を API から構造的に排除する。catalog_writer ロール分離と admin モデレーション API は別イシューとして Linear に登録する。

変更後のエンドポイント:

| エンドポイント                         | 変更                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- |
| `DELETE /api/artists/:id`              | **廃止**                                                             |
| `PATCH /api/artists/:id`               | 自由記述更新 → **Apple Music 再同期**(`syncSong` と同型。ボディ不要) |
| `PATCH /api/songs/:id`                 | 現状維持(既に再同期)                                                 |
| `POST /api/artists`, `POST /api/songs` | 現状維持(ペイロードは appleMusicId のみ)                             |

RLS は防御の第二層として `withCheck: deletedAt IS NULL` を artists/songs/genres の update ポリシーに追加(authenticated ロールでは論理削除を表現不可能にする)。

**実装時の追加判明事項(2026-07-17 実測)**: PostgreSQL は `INSERT ... ON CONFLICT DO UPDATE` の競合パスで既存行の読み取りに **SELECT ポリシー**を適用し、通常の UPDATE と異なりフィルタではなくエラー(`new row violates row-level security policy (USING expression)`)にする。`artists_select_active` / `songs_select_active` が authenticated にも `deletedAt IS NULL` を課していたため、復活 upsert(`findOrCreateArtists` / `createSongFull` / `createSongFromAppleMusic`)が authenticated ロールで失敗していた(songs 側は既存コードの潜在バグ)。対応として **authenticated 専用の全行 SELECT ポリシー `artists_select_all_authenticated` / `songs_select_all_authenticated`(`using: true`)を追加**。anon の SELECT は `deletedAt IS NULL` のまま、`withCheck: deletedAt IS NULL` も維持されるため「論理削除は不可能・復活 upsert は可能・公開読み取りは削除行を隠す」が両立する。アプリ層の authenticated 読み取りは全て `isNull(deletedAt)` を明示しており挙動変化なし。genres は復活経路(`onConflictDoNothing` のみ)がないため対象外。

## TDD テストリスト

**Unit(`__tests__/features/artists/route.test.ts`):**

1. `PATCH /api/artists/:id` → 200。`fetchArtist` は**既存行の** `appleMusicId` で呼ばれる(クライアント入力ではない)。ボディ不要
2. `PATCH /api/artists/:id` → 404(`artist-not-found`、DB に行がない)
3. `PATCH /api/artists/:id` → 400(UUID でない id)※既存維持
4. `PATCH /api/artists/:id` → 502(Apple Music API 失敗)
5. `POST /api/artists` → 409(重複 appleMusicId が **RlsError にラップされて**届くケース。`normalizeArtistDbError` を駆動)
6. `POST /api/artists` → 500(その他の DB エラー、RlsError ラップ経由)
7. `DELETE /api/artists/:id` → 404(ルート削除のロックイン)
8. 削除: PATCH ボディ系テスト(空ペイロード/不正ペイロード/appleMusicId 変更 409 等)と DELETE 系テスト

**DB(`__tests__/shared/db/rls.db.test.ts` に新 describe「カタログ論理削除保護」):**

9. `withAuthenticatedRole` で artists の `deletedAt` を UPDATE → `RlsError` が返り、行は変化しない
10. 同上 songs
11. 同上 genres
12. `withAuthenticatedRole` で active な artists の `name` UPDATE は成功する(同期パスの保証)
13. `findOrCreateArtists` は論理削除済みアーティストを復活できる(`onConflictDoUpdate` の `deletedAt: null` は新 withCheck を通る — リグレッションガード)

## 実装ステップ

### Phase 1 — RLS ポリシー + マイグレーション(テスト 9-13)

1. `rls.db.test.ts` に新テストを書き、`just db-start && bun run test:db --filter=api` で **Red** 確認
2. `apps/api/src/shared/db/schema.ts` を編集:
   - `artists_update_authenticated`(~L177): `withCheck: sql\`${table.deletedAt} IS NULL\``(`using`は`true` のまま — 変えると論理削除済み行の復活が壊れる)
   - `songs_update_authenticated`(~L264): 同様
   - `genres_update_authenticated`(~L389): 同様(genre は `onConflictDoNothing` のみで UPDATE する経路がなく無リスク)
3. `cd apps/api && bun run db:generate` → `20260506081947_chilly_hannibal_king` の後に新マイグレーション生成。**migration.sql をレビュー**(3 ポリシーのみ触っていること。ALTER POLICY か DROP+CREATE かは drizzle-kit 次第、どちらも可)
4. `bun run test:db --filter=api` → **Green**(test:db がマイグレーションを再適用)

### Phase 2 — model & repository

5. `apps/api/src/features/artists/model.ts`: `artistUpdateSchema` / `ArtistUpdateDbModel`(L24-32)を削除。追加:
   ```ts
   // Apple Music API 由来の再同期で更新可能な値(name のみ)
   export type ArtistSyncDbValues = Pick<ArtistCreateDbValues, "name">;
   ```
   (`fetchArtist` のレスポンスで可変なのは `attributes.name` のみ)
6. `apps/api/src/features/artists/repository.ts`: `softDeleteArtistById`(L60-70)削除。`updateArtistById` の values 型を `ArtistSyncDbValues` に変更(`isNull(deletedAt)` ガードと `returning` は維持)

### Phase 3 — usecase(テスト 1-7 を Red → Green)

7. `apps/api/src/features/artists/usecase.ts` を songs パターン(`songs/usecase.ts`)に揃えて書き換え:
   - `normalizeSongDbError`(songs/usecase.ts:31-37)と同型の `normalizeArtistDbError` を追加(RlsError の cause から unique violation を検出)
   - `getArtists` / `getArtist`: 読み取りを `withAnonymousRole` でラップ
   - `registerArtist`: `createArtist` を `withAuthenticatedRole` 内で実行、エラーは `normalizeArtistDbError`
   - **新 `syncArtist(id, db)`**(`modifyArtist` を置換、`syncSong`(songs/usecase.ts:97-138)を鏡写しに):
     1. `withAnonymousRole` で `findArtistById` → null なら `artist-not-found`
     2. `fetchArtist(existing.appleMusicId)` → エラーはそのまま返す
     3. `withAuthenticatedRole` で `updateArtistById(tx, { id, values: { name: apiResponse.attributes.name } })`
     4. null(読み書き間で削除)なら `artist-not-found`、エラーは `normalizeArtistDbError`
   - `modifyArtist` / `removeArtist` を削除

### Phase 4 — route

8. `apps/api/src/features/artists/route.ts`:
   - `artistUpdateBodyValidator`(L27-31)と `artistUpdateSchema` import を削除
   - PATCH ハンドラ: `csrfProtection()` + `requireAuthMiddleware()` + `artistIdParamValidator` は維持、ボディバリデータと空ペイロードチェックを削除、`syncArtist(id, c.var.db())` を呼ぶ(songs の PATCH と同型)
   - `.delete("/api/artists/:id", ...)` チェーン(L89-102)を丸ごと削除

### Phase 5 — テストファイル更新

9. `route.test.ts`: `mockDbWithTransaction` を songs 版(`songs/route.test.ts:66-75`、**`execute` スタブ入り**)に差し替え — RLS ヘルパーは `tx.execute("set local role ...")` を呼ぶため、これがないと GET 含む全テストが落ちる。PATCH テストを sync 型に書き換え(songs/route.test.ts:472-604 がモデル)。POST の 409/500 モックも transaction 対応に変更。冒頭のテストリストコメントを更新
10. usecase モジュールをモックしているレートリミットテストを修正: `__tests__/features/artists/artists-rate-limit.test.ts:23-24` と `__tests__/features/content-rate-limit-shared.test.ts:40-41` から `modifyArtist`/`removeArtist` を除き `syncArtist: vi.fn()` を追加

### Phase 6 — 後続イシューの Linear 登録

11. MUS-26 のフォローアップとして Linear に登録(MUS-26 と関連付け):
    - catalog_writer ロール分離(authenticated からカタログ insert/update ポリシーを剥奪)
    - admin モデレーション API(Firebase custom claims + 削除/復元エンドポイント)
    - (任意)PATCH sync エンドポイントへの rateLimitByUser 追加(songs も未設定。Apple Music API を叩くため)

## 落とし穴(調査で判明済み)

- ~~**`using` は緩めたまま `withCheck` だけ締める**~~ → **不正確だった**: ON CONFLICT DO UPDATE の競合行読み取りには UPDATE の using だけでなく **SELECT ポリシー**も適用される(psql で実証済み)。復活 upsert には authenticated 専用の全行 SELECT ポリシーが必要(上記「実装時の追加判明事項」参照)
- **RlsError ラップ**: `withAuthenticatedRole` はエラーを `RlsError` にラップして返すため、unique 制約検出は `error.cause` を見る必要がある(`normalizeArtistDbError` で対応)
- リポジトリは gitbutler/workspace ブランチで dbMiddleware リファクタリングが未コミット。現在のワーキングツリーの上に積む

## 検証

- `bun run test --filter=api` — unit 全緑
- `just db-start && bun run test:db --filter=api` — マイグレーション適用 + 新 RLS アサーション緑
- `bun run check-types` — AppType 縮小後も web がコンパイルできること
- `grep -rn "modifyArtist\|removeArtist\|softDeleteArtistById\|artistUpdateSchema\|ArtistUpdateDbModel" apps/` が空
- `bun run lint`(Definition of Done)
- 手動スモーク: 認証セッションで `PATCH /api/artists/:id` → name が Apple Music から更新される。`DELETE` → 404
- デプロイ時: 本番へ `db:migrate`。コード変更だけでエンドポイント経路は塞がるため適用順序は非依存(ポリシーは第二層)
