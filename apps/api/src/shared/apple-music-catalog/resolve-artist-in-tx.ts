import { DbError } from "@repo/errors";
import type { DatabaseTransaction } from "../db";
import type { ArtistInput } from "../apple-music/to-artist-input";
import { createArtistFromAppleMusic } from "../../features/artists/apple-music-sync";
import { findArtistByAppleMusicId } from "../../features/artists/repository";
import { catalogEntityMissingInTx } from "./sentinel";

// tx 内で artist を find し、無ければ artistInput から作成する。
// artistInput が無ければ「事前チェック後のレースで、まだ fetch していない」ことを示す
// catalogEntityMissingInTx を返すので、呼び出し元は withRaceRetry で recover すること。
export const resolveArtistInTx = async (
  tx: DatabaseTransaction,
  appleMusicId: string,
  artistInput: ArtistInput | null,
): Promise<{ artistId: string } | typeof catalogEntityMissingInTx | DbError> => {
  const found = await findArtistByAppleMusicId(tx, appleMusicId);
  if (found) {
    return { artistId: found.id };
  }

  if (!artistInput) return catalogEntityMissingInTx;

  const created = await createArtistFromAppleMusic(tx, appleMusicId, artistInput.name);
  if (!created[0]) {
    return new DbError({ message: "アーティスト情報の作成に失敗しました。" });
  }

  return { artistId: created[0].id };
};
