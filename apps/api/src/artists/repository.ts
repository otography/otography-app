import { artists } from "db";
import type { CatalogArtist } from "../lib/apple-music/catalog.ts";
import type { Database } from "../lib/db.ts";
import { findOrCreate, insertOrFindExisting } from "../lib/find-or-create.ts";
import { ArtistQueryError } from "./errors.ts";

const findArtist = ({ db, artistId }: { db: Database; artistId: string }) =>
  db.query.artists
    .findFirst({ where: { id: artistId } })
    .then((artist) => artist ?? null)
    .catch((error: unknown) => new ArtistQueryError({ artistId, cause: error }));

// 別のリクエストが同じアーティストを先に保存した場合は、その行を返す。
const saveArtist = ({ db, artist }: { db: Database; artist: CatalogArtist }) =>
  insertOrFindExisting({
    insert: () =>
      db
        .insert(artists)
        .values({ ...artist, fetchedAt: new Date() })
        .onConflictDoNothing()
        .returning()
        .catch((error: unknown) => new ArtistQueryError({ artistId: artist.id, cause: error })),
    find: () => findArtist({ db, artistId: artist.id }),
    missing: () =>
      new ArtistQueryError({ artistId: artist.id, cause: new Error("保存した行が見つからない") }),
  });

/**
 * お気に入りで選ばれたアーティストを返す。artists に行があれば Apple Music を呼ばない。
 * なければ Apple Music から取得して保存する（誰かがお気に入りにしたアーティストだけを保存する）。
 */
export function getOrCreateArtist<FetchError extends Error>({
  db,
  artistId,
  fetchArtist,
}: {
  db: Database;
  artistId: string;
  fetchArtist: (artistId: string) => Promise<FetchError | CatalogArtist>;
}) {
  return findOrCreate({
    find: () => findArtist({ db, artistId }),
    create: async () => {
      const fetched = await fetchArtist(artistId);
      return fetched instanceof Error ? fetched : saveArtist({ db, artist: fetched });
    },
  });
}
