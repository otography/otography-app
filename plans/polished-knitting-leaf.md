# Apple Music カタログ解決を ACL として切り出す

## Context

発端は Copilot のPRレビューコメント（`favorite-songs/usecase.ts` のコメントが「`songs/usecase.ts` は編集対象外」と事実と異なる記述をしていた点の指摘）。調査を進める中で、次の事実が判明した。

- `songs/usecase.ts` はこのPRで新規追加されたファイルであり、実際は編集対象内だった。
- `resolveOrCreateSong`（songs/usecase.ts）と同種の「Apple Music から find-or-create し、レース検知・リトライする」ロジックが `posts/usecase.ts`・`favorite-songs/usecase.ts`・`favorite-artists/usecase.ts` の計4箇所に、song／artist という2つのエンティティに対してそれぞれ独立に重複実装されていた。
- 重複の一部は**単なるコピーではなく、実装として非一貫**していた: `favorite-artists/usecase.ts` はレース（事前チェック後にレコードが消えていた場合）を検知しても再フェッチ・再試行せず、即座に防御的な500エラーを返して諦める。`favorite-songs`・`posts` は再フェッチして1回だけリトライする。
- Web調査の結果、「存在チェック→条件付き作成」という DB 書き込みそのものは TOCTOU（Time-of-check to time-of-use）レースの温床であり実務上のアンチパターンとされる。一方、「安いローカル存在チェックで高価な外部API呼び出し（Apple Music fetch）をスキップする」という最適化自体は Double-Checked Locking 的な正当なパターンであり、かつ Apple Music への fetch はレイテンシ・レート制限のある I/O のためDBトランザクション内に含めるべきではない、という制約もある。
- **最終判断: 現行の「事前存在チェック→条件付きフェッチ→tx内でレース検知→1回だけリトライ」という構造自体は実務的に妥当なので維持する。** 実際の DB 書き込み（`createSongFull`・`createArtistFromAppleMusic`）は元から `ON CONFLICT DO UPDATE` の冪等 upsert であり、アンチパターンには該当しない。問題だったのはこの構造が4箇所で重複・非一貫に再実装されていたことであり、構造自体を捨てることではない。

DDD の Anti-Corruction Layer（ACL）パターンに従い、「外部の Apple Music カタログを翻訳してドメインエンティティとして解決する」責務（事前チェック・条件付きフェッチ・tx内解決・レース時リトライの一式）を、消費側 feature（songs/posts/favorite-songs/favorite-artists）から独立した shared 層に切り出し、4箇所の重複と `favorite-artists` の非一貫バグを解消する。

## アプローチ

### 1. アダプタ層の対称性を整える

`apps/api/src/shared/apple-music/to-song-input.ts` は既に「外部レスポンス → ドメイン入力形」の翻訳を担っている。artist 側にも同じ役割の関数がなく、`favorite-artists/usecase.ts` が `appleMusicArtist.attributes.name` を直接触っていた（ACL 違反）。対称性を取るため:

- 新規: `apps/api/src/shared/apple-music/to-artist-input.ts` — `toArtistInput(apiResponse: Awaited<ReturnType<typeof fetchArtist>>)` を追加し、`{ name, appleMusicId }` 相当のドメイン入力形を返す（`to-song-input.ts` と同じ Error パススルー方式）。
- `shared/apple-music/index.ts` に re-export を追加。

### 2. ACL 本体: `shared/apple-music-catalog/`（新規ディレクトリ）

`shared/apple-music/` のディレクトリ+`index.ts` 構成を踏襲。現行構造（事前チェック外部・tx内解決・リトライ）を保ったまま、tx内の解決ロジックとリトライ制御を shared 化する。

```
apps/api/src/shared/apple-music-catalog/
  sentinel.ts          # catalogEntityMissingInTx シンボル（song/artist共通）
  resolve-song-in-tx.ts
  resolve-artist-in-tx.ts
  with-race-retry.ts    # favorite-songs/usecase.ts の withRaceRetry を汎用化して移設
  index.ts
```

- `resolveSongInTx(tx: DatabaseTransaction, appleMusicId: string, songInput: SongInput | null): Promise<{ songId: string } | typeof catalogEntityMissingInTx | DbError>`
  - `findSongByAppleMusicId` で既存を探す。見つかればそれを返す。見つからず `songInput` も無ければ `catalogEntityMissingInTx`（＝呼び出し元は事前チェック後のレース、recover が必要）を返す。`songInput` があれば `findOrCreateArtists`（既存の冪等バッチupsert）→ `createSongFull`（既存の冪等upsert）で作成する。
  - フォールバックメッセージは呼び出し元ごとに変えず、ステップ単位で1つずつの汎用日本語文言に固定する（例:「アーティスト情報の解決に失敗しました。」「楽曲情報の作成に失敗しました。」）。`toDbError` のフォールバックは元々「予期しない内部エラー」用の最後の砦であり、feature ごとに書き分ける必要はないという結論に基づく。既知の制約違反（unique constraint 等）は従来通り `POSTGRES_CONSTRAINTS` レジストリ経由で正しくローカライズされるため影響なし。
- `resolveArtistInTx(tx: DatabaseTransaction, appleMusicId: string, artistInput: ArtistInput | null): Promise<{ artistId: string } | typeof catalogEntityMissingInTx | DbError>`
  - 同型。`findArtistByAppleMusicId` → 無ければ `artistInput` が無ければセンチネル、あれば `createArtistFromAppleMusic`（既存の冪等upsert）。
- `withRaceRetry<T>({ attempt, recover, fallbackErrorMessage })` — `favorite-songs/usecase.ts` に現存する実装をそのまま shared に昇格。`attempt()` が `catalogEntityMissingInTx` を返したら `recover()`（再フェッチ）を呼び、1回だけ `attempt()` を再実行する汎用リトライハーネス。song/artist どちらの呼び出し元からも共用する。

`resolveSongInTx`/`resolveArtistInTx` は `db.transaction()` を自前で開かない（`shared/db/rls.ts` の3関数のみがトランザクションを所有する、という既存の慣習を踏襲）。fetch（Apple Music 呼び出し）は tx の外で行い、`songInput`/`artistInput` として tx の中に渡す — 現行の `favorite-songs/usecase.ts` と同じ責務分割。

### 3. 消費側4箇所を置き換える

4箇所とも「事前存在チェック（`Database` で実行）→ 無ければ Apple Music fetch → `withRls` 内で `resolveXxxInTx` → センチネルなら `recover` して `withRaceRetry` が1回リトライ」という同型の骨格になる。代表として `favorite-songs/usecase.ts` の形を示す（他3ファイルも同じ形で適用）:

```ts
const songExists = await songExistsByAppleMusicId(db, input.appleMusicId).catch((e) =>
  toDbError(e, "楽曲の検索に失敗しました。"),
);
if (songExists instanceof Error) return songExists;

const prepareSongInput = async () => {
  const apiResponse = await fetchSong(input.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;
  return toSongInput(apiResponse);
};

let songInput: SongInput | null = null;
if (!songExists) {
  const prepared = await prepareSongInput();
  if (prepared instanceof Error) return prepared;
  songInput = prepared;
}

const outcome = await withRaceRetry({
  attempt: () =>
    withRls(db, session, async (tx, userId) => {
      const resolved = await resolveSongInTx(tx, input.appleMusicId, songInput);
      if (resolved === catalogEntityMissingInTx) return catalogEntityMissingInTx;
      if (resolved instanceof Error) return resolved;
      return insertFavoriteSong(tx, userId, resolved.songId, favoriteValues);
    }),
  recover: async () => {
    const prepared = await prepareSongInput();
    if (prepared instanceof Error) return prepared;
    songInput = prepared;
  },
  fallbackErrorMessage: "楽曲情報の取得に失敗しました。",
});
```

対象ファイルと変更内容:

- `apps/api/src/features/songs/usecase.ts` — `resolveOrCreateSong`・ローカルの `songMissingInTx` を削除し、shared 層の `resolveSongInTx`/`catalogEntityMissingInTx` を使う形に置き換え。
- `apps/api/src/features/posts/usecase.ts` — 手組みの再実行ループ（`runTransaction` を2回呼ぶ形）を、shared の `withRaceRetry` + `resolveSongInTx` に置き換え。
- `apps/api/src/features/favorite-songs/usecase.ts` — ローカルの `withRaceRetry`・`songMissingInTx`・tx内の find-or-create ロジックを削除し、shared 層を呼ぶ形に置き換え。
- `apps/api/src/features/favorite-artists/usecase.ts` — 上記と同じ骨格に揃える（`resolveArtistInTx` + `withRaceRetry` を使用）。これにより、レース時に何もせず諦めていた非一貫バグが構造的に解消され、他3箇所と同じリトライ挙動になる。

### 4. テスト（t-wada TDD、CLAUDE.md の規約に従う）

- 新規: `apps/api/src/__tests__/shared/apple-music-catalog/resolve-song-in-tx.test.ts` / `resolve-artist-in-tx.test.ts` / `with-race-retry.test.ts`。`favorite-artists/usecase.test.ts` の `vi.hoisted` + `vi.mock` パターン（`features/*/repository`・`features/artists/apple-music-sync` を個別にモック）を踏襲し、「既存あり」「見つからず input あり→作成」「見つからず input 無し→センチネル」「upsert失敗」の各分岐と、リトライハーネスの「1回だけ再試行」「recover 失敗時はそのまま伝播」をカバー。
- 既存4ファイルの usecase テスト（`posts/usecase.test.ts`・`favorite-songs/usecase.test.ts`・`favorite-artists/usecase.test.ts`）を更新: tx内ロジックのモック対象を `resolveSongInTx`/`resolveArtistInTx`・shared `withRaceRetry` に差し替え。`favorite-artists/usecase.test.ts` の「レース時に再フェッチせず defensive 500 を返す」テストは、他3箇所と同じ「レース検知後に再フェッチしてリトライし成功する」テストに置き換える（挙動が変わるため）。
- テストリストを列挙 → 1件ずつ Red→Green→Refactor で進める（実装の設計判断をテストリスト段階で混ぜない）。

## 検証

- `bun run test --filter=api`（新規・更新した unit テストがすべて green になること）
- `bun run check-types --filter=api`
- `bun run lint`
- 冪等 upsert のDB挙動自体（`createSongFull`・`createArtistFromAppleMusic`・`findOrCreateArtists`）・事前チェック関数（`songExistsByAppleMusicId`／`artistExistsByAppleMusicId`）は変更しないため、既存の `songs/repository.db.test.ts` 等の DB integration テストは無改修で通ることを確認する。
