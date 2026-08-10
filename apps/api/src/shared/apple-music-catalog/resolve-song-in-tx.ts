import { DbError } from "@repo/errors";
import type { DatabaseTransaction } from "../db";
import { toDbError } from "../db/postgres-error";
import type { SongInput } from "../apple-music/to-song-input";
import { findOrCreateArtists } from "../../features/artists/apple-music-sync";
import { createSongFull, findSongByAppleMusicId } from "../../features/songs/repository";
import { catalogEntityMissingInTx } from "./sentinel";

// tx 内で song を find し、無ければ songInput から作成する。
// songInput が無ければ「事前チェック後のレースで、まだ fetch していない」ことを示す
// catalogEntityMissingInTx を返すので、呼び出し元は withRaceRetry で recover すること。
export const resolveSongInTx = async (
  tx: DatabaseTransaction,
  appleMusicId: string,
  songInput: SongInput | null,
): Promise<{ songId: string } | typeof catalogEntityMissingInTx | DbError> => {
  const found = await findSongByAppleMusicId(tx, appleMusicId);
  if (found) {
    return { songId: found.id };
  }

  if (!songInput) return catalogEntityMissingInTx;

  const artistIds = await findOrCreateArtists(tx, songInput.artistEntries).catch((e) =>
    toDbError(e, "アーティスト情報の解決に失敗しました。"),
  );
  if (artistIds instanceof Error) return artistIds;

  const song = await createSongFull(tx, {
    songValues: songInput.songValues,
    artistIds,
    genreNames: songInput.genreNames,
  });
  if (!song) {
    return new DbError({ message: "楽曲情報の作成に失敗しました。" });
  }

  return { songId: song.id };
};
