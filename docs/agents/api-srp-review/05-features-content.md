# 05 — features/posts, post-likes, user SRPレビュー

**対象ファイル**:

- `features/posts/` (5ファイル)
- `features/post-likes/` (5ファイル)
- `features/user/` (5ファイル)

## 結果サマリー

| ファイル                 | SRP | 合成性 |
| ------------------------ | --- | ------ |
| posts/index.ts           | ✅  | ✅     |
| posts/model.ts           | ✅  | ✅     |
| posts/repository.ts      | ⚠️  | ✅     |
| posts/route.ts           | ✅  | ✅     |
| posts/usecase.ts         | ⚠️  | ✅     |
| post-likes/index.ts      | ✅  | ✅     |
| post-likes/model.ts      | ✅  | ✅     |
| post-likes/repository.ts | ✅  | ✅     |
| post-likes/route.ts      | ✅  | ✅     |
| post-likes/usecase.ts    | ✅  | ✅     |
| user/index.ts            | ✅  | ✅     |
| user/model.ts            | ✅  | ✅     |
| user/repository.ts       | ✅  | ✅     |
| user/route.ts            | ⚠️  | ⚠️     |
| user/usecase.ts          | ⚠️  | ✅     |

## 詳細（問題のあるファイルのみ）

### `posts/repository.ts` ⚠️

**問題点**:

- **`likeFields`（行17-24）が post_likes テーブルに依存**: posts リポジトリが post-likes feature のテーブル構造を知っている。`postLikes` テーブルと `exists` サブクエリに直接依存。
  ```ts
  const likeFields = {
    isLiked: exists(...).as("is_liked"),
    likeCount: ...as("like_count"),
  };
  ```
- `listPostsWithLikes`（行25-55）と `findPostByIdWithLikes`（行58-72）で投稿取得といいね取得が1クエリに結合されている。パフォーマンス上の正当な理由（N+1回避）があるが、関心の分離の観点では問題。

**推奨**:

- `likeFields` サブクエリビルダーを `post-likes/repository.ts` に移動し、posts 側はそれを import して使う形にする

---

### `posts/usecase.ts` ⚠️

**問題点**:

1. **`registerPost`（行82-165）の複数責務混在**（83行）:
   - 曲存在チェック（行86-91）
   - Apple Music API 呼び出しと songInput 準備（行93-104）
   - トランザクション内での曲アップサート（artist 解決含む）（行106-148）
   - レース条件検知とリトライロジック（行150-163）
   - エラー変換（行165-173）
   - 特に行106-148 の `runTransaction` 内で、songs リポジトリ・artists リポジトリへの呼び出しと投稿作成が混在

2. **`resolveUserId`（行18-33）の配置**: Firebase ID → UUID 変換が posts usecase 内に定義されている。複数 feature で必要になる共通関心事。`shared/` または `user/` feature に属するべき。

**推奨**:

1. `registerPost` の曲解決ロジック（行106-148）を `songs/usecase.ts` の `resolveOrCreateSong(tx, appleMusicId, songInput)` のような関数に抽出
2. `resolveUserId` を `shared/` または `user/repository.ts` に抽出し共通化

---

### `user/route.ts` ⚠️⚠️

**問題点**:

**DELETE `/api/user` ハンドラ（行146-187）に認証失効ビジネスロジックが漏出**:

このハンドラ内に以下の複数責務が混在:

- セッション検証（行148-153）
- 全セッション失効 `revokeAllUserSessions`（行156-165）
- Firebase リフレッシュトークン無効化 `revokeRefreshTokens`（行167-181）
- Cookie クリア `clearOpaqueSessionCookie`（行176, 185, 187）
- アカウント削除 usecase 呼び出し（行184）
- エラーラップ処理（`new AuthError` 構築 行160-164, 172-180）

他のハンドラ（GET, PATCH）は thin だが、DELETE だけが fat。

**推奨**:

- DELETE ハンドラ内の認証失効ロジック（行156-187）を usecase 層（例: `teardownUserAccount`）に移動
- route は `const result = await deleteAccount(session, c.var.db())` だけを呼ぶ形に
- Cookie クリアは route 層に残してもよいが、AuthError 構築と複数ステップのオーケストレーションは usecase に

---

### `user/usecase.ts` ⚠️

**問題点**:

1. **`getProfile`（行86-150）の自己修復ロジック**:
   - プロフィール取得（行88-90）
   - **ユーザーレコード不在時の自己修復（`createUserRecord` 呼び出し）（行94-119）**: 別ユースケース（サインアップ/同期）の関心事が `getProfile` に混入
   - プロフィール未設定判定とドメインエラー生成（行138-147）
   - Firebase セッションからの email/photoUrl 結合（行149）
   - インライン即時関数 `(async () => { ... })()`（行97-119）で可読性が低い

2. **`createUserRecord`（行60-87）の配置**: サインアップ時のユーザー作成ロジックが `getProfile` とは別の export として存在するが、本来 auth feature に属する可能性。

**推奨**:

1. `getProfile` の自己修復ロジック（行94-119）を別関数 `ensureUserRecord(session, db)` に抽出
2. `createUserRecord` を auth feature または signup usecase に移動することを検討
3. `deleteAccount` usecase を拡張して認証失効を含めた `teardownUserAccount` を新設し、route の DELETE ハンドラを thin に

---

## Top アクションアイテム

1. **`user/route.ts` DELETE ハンドラ**: 認証失効オーケストレーション（行156-187）を usecase に移動
2. **`posts/usecase.ts` `registerPost`**: 曲解決ロジック（行106-148）を songs usecase に抽出
3. **`user/usecase.ts` `getProfile`**: 自己修復ロジック（行94-119）を分離
4. **`posts/repository.ts` `likeFields`**: post-likes feature に移動（行17-24）
5. **`posts/usecase.ts` `resolveUserId`**: 共通ユーティリティに抽出（行18-33）
