import { DbError } from "@repo/errors";
import { describe, expect, it, vi } from "vitest";
import { getFavoritePage } from "../../../features/favorites/usecase";

describe("favorites shared usecase", () => {
  it("converts a rejected loader into the configured database error", async () => {
    type FavoriteRow = {
      favorite: {
        resourceId: string;
        comment: string | null;
        emoji: string | null;
        color: string | null;
        createdAt: string;
      };
      resource: { id: string };
    };

    const cause = new Error("query failed");
    const load = vi.fn<() => Promise<FavoriteRow[]>>().mockRejectedValue(cause);

    const result = await getFavoritePage({
      load,
      errorMessage: "お気に入りの取得に失敗しました。",
      getFavoriteId: (row) => row.favorite.resourceId,
      mapResource: (row) => ({ resource: row.resource }),
    });

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "お気に入りの取得に失敗しました。",
      statusCode: 500,
      cause,
    });
  });
});
