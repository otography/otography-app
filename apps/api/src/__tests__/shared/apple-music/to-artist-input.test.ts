import { describe, expect, it } from "vitest";
import { AppleMusicError } from "@repo/errors";
import { toArtistInput } from "../../../shared/apple-music/to-artist-input";

/*
 * テストリスト: toArtistInput（Apple Music API レスポンス → ドメイン入力形の変換）
 *
 * 1. apiResponse が Error の場合、そのまま Error を返す（パススルー）
 * 2. 正常な apiResponse から { name, appleMusicId } を構築する
 */
describe("toArtistInput", () => {
  it("apiResponse が Error の場合、そのまま Error を返す", () => {
    const error = new AppleMusicError({ message: "取得に失敗しました。" });

    const result = toArtistInput(error);

    expect(result).toBe(error);
  });

  it("正常な apiResponse から { name, appleMusicId } を構築する", () => {
    const apiResponse = {
      id: "123456",
      type: "artists" as const,
      attributes: { name: "Test Artist" },
    };

    const result = toArtistInput(apiResponse);

    expect(result).toMatchObject({ name: "Test Artist", appleMusicId: "123456" });
  });
});
