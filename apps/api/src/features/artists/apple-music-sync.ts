// Apple Music 由来のアーティスト同期ヘルパー群。
// songs（find-or-create）、favorite-artists（upsert）から呼ばれる cross-feature な責務を集約し、
// artists/repository.ts を純粋な CRUD に保つために分離している。
import { and, inArray, isNull, sql } from "drizzle-orm";
import { artists } from "../../shared/db/schema";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import { artistLookupColumns } from "./repository";

// アーティストを新規作成（Apple Music API から取得した情報を使用）
export const createArtistFromAppleMusic = async (
  tx: DatabaseTransaction,
  appleMusicId: string,
  name: string,
) => {
  return tx
    .insert(artists)
    .values({ name, appleMusicId })
    .onConflictDoUpdate({
      target: artists.appleMusicId,
      set: {
        name,
        deletedAt: null,
      },
    })
    .returning(artistLookupColumns);
};

// アーティストをバッチで find-or-create し、DB上のID配列を返す
export const findOrCreateArtists = async (
  db: DatabaseOrTransaction,
  artistEntries: { appleMusicId: string; name: string }[],
) => {
  if (artistEntries.length === 0) return [];

  // 未登録アーティストを一括 INSERT
  const newArtists = artistEntries.filter((a) => a.name);
  if (newArtists.length > 0) {
    await db
      .insert(artists)
      .values(newArtists.map((a) => ({ name: a.name, appleMusicId: a.appleMusicId })))
      .onConflictDoUpdate({
        target: artists.appleMusicId,
        set: {
          name: sql`EXCLUDED.name`,
          deletedAt: null,
        },
      });
  }

  // 全アーティストの Apple Music ID で一括 SELECT
  // soft-delete 済み artist は除外し、非表示の song_artists 紐付けを防ぐ
  const appleMusicIds = artistEntries.map((a) => a.appleMusicId);
  const found = await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(inArray(artists.appleMusicId, appleMusicIds), isNull(artists.deletedAt)));

  return found.map((r) => r.id);
};
