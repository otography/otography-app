# API SRP Review — apps/api/src

**レビュー日**: 2026-08-06
**対象**: `apps/api/src/` 配下の全プロダクションファイル（テスト・ヘルパー除く、計92ファイル）
**評価基準**:

- **SRP（単一責任原則）**: 各ファイルが単一の責務を持つか
- **合成可能性（Composability）**: 他の適切に名付けられた関数を呼び出し、複雑な振る舞いを構成できるか

## サマリー

| 評価                         | ファイル数 | 割合 |
| ---------------------------- | ---------- | ---- |
| ✅✅ (SRP・合成性ともに適合) | 68         | 74%  |
| ⚠️ (いずれかが問題あり)      | 22         | 24%  |
| ❌ (いずれかが違反)          | 2          | 2%   |

**全体評価**: アーキテクチャは非常に健全。feature-based の route/usecase/repository/model パターンが一貫して適用されており、合成性は全ファイルで高い水準。主な改善余地は「route層へのビジネスロジック漏出」「クロスfeatureな責務の混在」「ファイル分割による認知負荷軽減」にある。

## レポート一覧

| レポート                                           | 対象ディレクトリ                                                          | 主要な発見                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [01-root.md](./01-root.md)                         | `src/index.ts`, `client.ts`, `env.drizzle.ts`                             | index.ts のインラインCORS・重複ミドルウェア登録                       |
| [02-features-simple.md](./02-features-simple.md)   | `apple-music/`, `health/`, `errors/`                                      | health/route.ts の責務混在、errors/route.ts のインラインHTML          |
| [03-features-auth.md](./03-features-auth.md)       | `auth/`                                                                   | **usecase層の欠落**（最大の構造的問題）                               |
| [04-features-crud.md](./04-features-crud.md)       | `artists/`, `songs/`, `favorites*/`                                       | favorite 系のエラー正規化の層違反、リトライロジックのインライン化     |
| [05-features-content.md](./05-features-content.md) | `posts/`, `post-likes/`, `user/`                                          | posts/usecase の曲解決ロジック混入、user/route のDELETEハンドラ肥大化 |
| [06-shared-auth.md](./06-shared-auth.md)           | `shared/auth/` (12ファイル)                                               | session-service.ts の動的import・サイズ、重複ユーティリティ           |
| [07-shared-infra.md](./07-shared-infra.md)         | `shared/db/`, `errors/`, `firebase/`                                      | error-registry.ts の3関心事混在、schema.ts の巨大化                   |
| [08-shared-misc.md](./08-shared-misc.md)           | `shared/middleware/`, `logging/`, `pagination/`, `types/`, `apple-music/` | 軽微な抽出の機会のみ                                                  |

## 優先度別 アクションアイテム

### 🔴 高優先度（構造的な問題）

1. **`features/auth/` にusecase層を新設** → [03-features-auth.md](./03-features-auth.md)
   - route.ts と lib/google.ts がビジネスロジックを内包している
   - プロジェクトパターン（route/usecase/repository/model）との不整合

2. **`features/user/route.ts` DELETE ハンドラから認証失効ロジックを抽出** → [05-features-content.md](./05-features-content.md)
   - セッション失効、Firebase無効化、Cookie削除がroute層に漏出

3. **`features/posts/usecase.ts` `registerPost` の曲解決ロジックを分離** → [05-features-content.md](./05-features-content.md)
   - 83行の関数が複数責務を抱合

### 🟡 中優先度（一貫性の改善）

4. **favorite系repositoryのエラー正規化をusecase層へ移動** → [04-features-crud.md](./04-features-crud.md)
5. **`features/health/route.ts` のチェック関数とステータス集約を分離** → [02-features-simple.md](./02-features-simple.md)
6. **`shared/errors/error-registry.ts` を3ファイルへ分割** → [07-shared-infra.md](./07-shared-infra.md)
7. **`features/favorite-artists/usecase.ts` のraw Drizzleクエリをrepository呼び出しに置換** → [04-features-crud.md](./04-features-crud.md)

### 🟢 低優先度（認知負荷の軽減）

8. **`shared/db/schema.ts` のドメイン別ファイル分割** → [07-shared-infra.md](./07-shared-infra.md)
9. **`shared/auth/` の重複ユーティリティ（bytesToHex等）を共通化** → [06-shared-auth.md](./06-shared-auth.md)
10. **`features/errors/route.ts` のHTMLテンプレートを分離** → [02-features-simple.md](./02-features-simple.md)
