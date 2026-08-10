import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import type { SongInput } from "../../../shared/apple-music/to-song-input";

const mocks = vi.hoisted(() => ({
  findSongByAppleMusicId: vi.fn(),
  createSongFull: vi.fn(),
  findOrCreateArtists: vi.fn(),
}));

vi.mock("../../../features/songs/repository", () => ({
  findSongByAppleMusicId: mocks.findSongByAppleMusicId,
  createSongFull: mocks.createSongFull,
}));

vi.mock("../../../features/artists/apple-music-sync", () => ({
  findOrCreateArtists: mocks.findOrCreateArtists,
}));

import { catalogEntityMissingInTx } from "../../../shared/apple-music-catalog/sentinel";
import { resolveSongInTx } from "../../../shared/apple-music-catalog/resolve-song-in-tx";

const tx = { kind: "tx" } as never;

const songInput: SongInput = {
  songValues: { title: "Title", appleMusicId: "am-1", length: 180, isrcs: null },
  genreNames: ["Pop"],
  artistEntries: [{ appleMusicId: "artist-1", name: "Artist" }],
};

/*
 * テストリスト: resolveSongInTx（tx 内で song を find、無ければ songInput から作成する）
 *
 * 1. 既存の song が見つかれば、artist解決・作成を呼ばずに { songId } を返す
 * 2. 見つからず songInput が null なら、catalogEntityMissingInTx を返す
 * 3. 見つからず songInput があれば、artist を解決してから song を作成し { songId } を返す
 * 4. artist 解決が失敗したら、そのエラーを DbError として返す
 * 5. song 作成（createSongFull）が null を返したら、固定メッセージの DbError を返す
 */
describe("resolveSongInTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("既存の song が見つかれば、それを返す", async () => {
    mocks.findSongByAppleMusicId.mockResolvedValue({ id: "song-1" });

    const result = await resolveSongInTx(tx, "am-1", songInput);

    expect(result).toEqual({ songId: "song-1" });
    expect(mocks.findOrCreateArtists).not.toHaveBeenCalled();
    expect(mocks.createSongFull).not.toHaveBeenCalled();
  });

  it("見つからず songInput が null なら、catalogEntityMissingInTx を返す", async () => {
    mocks.findSongByAppleMusicId.mockResolvedValue(null);

    const result = await resolveSongInTx(tx, "am-1", null);

    expect(result).toBe(catalogEntityMissingInTx);
  });

  it("見つからず songInput があれば、artist解決→song作成して { songId } を返す", async () => {
    mocks.findSongByAppleMusicId.mockResolvedValue(null);
    mocks.findOrCreateArtists.mockResolvedValue(["artist-id-1"]);
    mocks.createSongFull.mockResolvedValue({ id: "song-2" });

    const result = await resolveSongInTx(tx, "am-1", songInput);

    expect(result).toEqual({ songId: "song-2" });
    expect(mocks.findOrCreateArtists).toHaveBeenCalledWith(tx, songInput.artistEntries);
    expect(mocks.createSongFull).toHaveBeenCalledWith(tx, {
      songValues: songInput.songValues,
      artistIds: ["artist-id-1"],
      genreNames: songInput.genreNames,
    });
  });

  it("artist解決が失敗したら、DbErrorを返す", async () => {
    mocks.findSongByAppleMusicId.mockResolvedValue(null);
    mocks.findOrCreateArtists.mockRejectedValue(new Error("db down"));

    const result = await resolveSongInTx(tx, "am-1", songInput);

    expect(result).toBeInstanceOf(DbError);
    expect(mocks.createSongFull).not.toHaveBeenCalled();
  });

  it("song作成が失敗（null）したら、固定メッセージのDbErrorを返す", async () => {
    mocks.findSongByAppleMusicId.mockResolvedValue(null);
    mocks.findOrCreateArtists.mockResolvedValue(["artist-id-1"]);
    mocks.createSongFull.mockResolvedValue(null);

    const result = await resolveSongInTx(tx, "am-1", songInput);

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({ message: "楽曲情報の作成に失敗しました。" });
  });
});
