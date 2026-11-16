import { artists } from "db";
import type { CatalogArtist } from "../lib/apple-music/catalog.ts";
import type { Database } from "../lib/db.ts";
import { ArtistQueryError } from "./errors.ts";

const findArtist = ({ db, artistId }: { db: Database; artistId: string }) =>
  db.query.artists
    .findFirst({ where: { id: artistId } })
    .then((artist) => artist ?? null)
    .catch((e) => new ArtistQueryError({ artistId, cause: e }));

async function saveArtist({ db, artist }: { db: Database; artist: CatalogArtist }) {
  const inserted = await db
    .insert(artists)
    .values({ ...artist, fetchedAt: new Date() })
    .onConflictDoNothing()
    .returning()
    .catch((e) => new ArtistQueryError({ artistId: artist.id, cause: e }));
  if (inserted instanceof Error) return inserted;

  const [row] = inserted;
  if (row) return row;

  // 別のリクエストが同じアーティストを先に保存した場合は、その行を返す。
  const existing = await findArtist({ db, artistId: artist.id });
  if (existing instanceof Error) return existing;
  if (!existing)
    return new ArtistQueryError({
      artistId: artist.id,
      cause: new Error("保存した行が見つからない"),
    });
  return existing;
}

/**
 * お気に入りで選ばれたアーティストを返す。artists に行があれば Apple Music を呼ばない。
 * なければ Apple Music から取得して保存する（誰かがお気に入りにしたアーティストだけを保存する）。
 */
export async function getOrCreateArtist<FetchError extends Error>({
  db,
  artistId,
  fetchArtist,
}: {
  db: Database;
  artistId: string;
  fetchArtist: (artistId: string) => Promise<FetchError | CatalogArtist>;
}) {
  const existing = await findArtist({ db, artistId });
  if (existing instanceof Error) return existing;
  if (existing) return existing;

  const fetched = await fetchArtist(artistId);
  if (fetched instanceof Error) return fetched;

  return saveArtist({ db, artist: fetched });
}
