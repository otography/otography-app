import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import type { ArtistInput } from "../../../shared/apple-music/to-artist-input";

const mocks = vi.hoisted(() => ({
  findArtistByAppleMusicId: vi.fn(),
  createArtistFromAppleMusic: vi.fn(),
}));

vi.mock("../../../features/artists/repository", () => ({
  findArtistByAppleMusicId: mocks.findArtistByAppleMusicId,
}));

vi.mock("../../../features/artists/apple-music-sync", () => ({
  createArtistFromAppleMusic: mocks.createArtistFromAppleMusic,
}));

import { catalogEntityMissingInTx } from "../../../shared/apple-music-catalog/sentinel";
import { resolveArtistInTx } from "../../../shared/apple-music-catalog/resolve-artist-in-tx";

const tx = { kind: "tx" } as never;

const artistInput: ArtistInput = { name: "Artist", appleMusicId: "am-1" };

/*
 * テストリスト: resolveArtistInTx（tx 内で artist を find、無ければ artistInput から作成する）
 *
 * 1. 既存の artist が見つかれば、作成を呼ばずに { artistId } を返す
 * 2. 見つからず artistInput が null なら、catalogEntityMissingInTx を返す
 * 3. 見つからず artistInput があれば作成し { artistId } を返す
 * 4. 作成（createArtistFromAppleMusic）が空配列を返したら、固定メッセージの DbError を返す
 */
describe("resolveArtistInTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("既存の artist が見つかれば、それを返す", async () => {
    mocks.findArtistByAppleMusicId.mockResolvedValue({ id: "artist-1" });

    const result = await resolveArtistInTx(tx, "am-1", artistInput);

    expect(result).toEqual({ artistId: "artist-1" });
    expect(mocks.createArtistFromAppleMusic).not.toHaveBeenCalled();
  });

  it("見つからず artistInput が null なら、catalogEntityMissingInTx を返す", async () => {
    mocks.findArtistByAppleMusicId.mockResolvedValue(null);

    const result = await resolveArtistInTx(tx, "am-1", null);

    expect(result).toBe(catalogEntityMissingInTx);
  });

  it("見つからず artistInput があれば作成して { artistId } を返す", async () => {
    mocks.findArtistByAppleMusicId.mockResolvedValue(null);
    mocks.createArtistFromAppleMusic.mockResolvedValue([{ id: "artist-2" }]);

    const result = await resolveArtistInTx(tx, "am-1", artistInput);

    expect(result).toEqual({ artistId: "artist-2" });
    expect(mocks.createArtistFromAppleMusic).toHaveBeenCalledWith(tx, "am-1", "Artist");
  });

  it("作成が空配列を返したら、固定メッセージのDbErrorを返す", async () => {
    mocks.findArtistByAppleMusicId.mockResolvedValue(null);
    mocks.createArtistFromAppleMusic.mockResolvedValue([]);

    const result = await resolveArtistInTx(tx, "am-1", artistInput);

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({ message: "アーティスト情報の作成に失敗しました。" });
  });
});
