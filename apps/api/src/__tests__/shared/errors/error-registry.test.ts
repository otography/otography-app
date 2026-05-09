/**
 * テストリスト: エラーレジストリ (error-registry)
 *
 * 構造の検証:
 * 1. ERROR_TYPES に20のエントリが含まれる
 * 2. 全エントリの slug が一意である
 * 3. 各エントリに typeUri, title, description, statusCode が存在する
 * 4. typeUri が https://api.otography.com/errors/{slug} 形式である
 *
 * getBySlug の検証:
 * 5. 既知の slug で正しいエントリを返す
 * 6. 未知の slug で undefined を返す
 *
 * getAllSlugs の検証:
 * 7. 全20の slug の配列を返す
 *
 * 各エラー型のステータスコード検証:
 * 8. email-already-registered → 409
 * 9. username-already-taken → 409
 * 10. artist-already-exists → 409
 * 11. song-already-exists → 409
 * 12. favorite-artist-already-exists → 409
 * 13. favorite-song-already-exists → 409
 * 14. account-conflict → 409
 * 15. profile-not-set-up → 404
 * 16. post-not-found → 404
 * 17. artist-not-found → 404
 * 18. song-not-found → 404
 * 19. session-expired → 401
 * 20. session-revoked → 401
 * 21. session-invalid → 401
 * 22. account-disabled → 403
 * 23. rate-limit-exceeded → 429
 * 24. oauth-exchange-failed → 502
 * 25. google-token-exchange-failed → 502
 * 26. firebase-idp-signin-failed → 502
 * 27. auth-service-unavailable → 503
 *
 * typeUri の一意性:
 * 28. 全 typeUri が一意である
 *
 * getProblemTypeUri の検証:
 * 29. 既知の slug で正しい typeUri 文字列を返す
 * 30. getProblemTypeUri は既知 slug のみを受け取り、typo は型エラーにする
 */
import { describe, expect, it } from "vitest";
import {
  ERROR_TYPES,
  POSTGRES_CONSTRAINTS,
  getBySlug,
  getAllSlugs,
  getPostgresConstraint,
  getProblemType,
  getProblemTypeUri,
} from "../../../shared/errors/error-registry";

const ALL_SLUGS = [
  "email-already-registered",
  "username-already-taken",
  "artist-already-exists",
  "song-already-exists",
  "favorite-artist-already-exists",
  "favorite-song-already-exists",
  "account-conflict",
  "profile-not-set-up",
  "post-not-found",
  "artist-not-found",
  "song-not-found",
  "session-expired",
  "session-revoked",
  "session-invalid",
  "account-disabled",
  "rate-limit-exceeded",
  "oauth-exchange-failed",
  "google-token-exchange-failed",
  "firebase-idp-signin-failed",
  "auth-service-unavailable",
] as const;

describe("error-registry", () => {
  describe("構造の検証", () => {
    it("ERROR_TYPES に20のエントリが含まれる", () => {
      expect(ERROR_TYPES).toHaveLength(20);
    });

    it("全エントリの slug が一意である", () => {
      const slugs = ERROR_TYPES.map((e) => e.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("各エントリに typeUri, title, description, statusCode が存在する", () => {
      for (const entry of ERROR_TYPES) {
        expect(entry).toHaveProperty("slug");
        expect(entry).toHaveProperty("typeUri");
        expect(entry).toHaveProperty("title");
        expect(entry).toHaveProperty("description");
        expect(entry).toHaveProperty("statusCode");
        expect(typeof entry.slug).toBe("string");
        expect(typeof entry.typeUri).toBe("string");
        expect(typeof entry.title).toBe("string");
        expect(typeof entry.description).toBe("string");
        expect(typeof entry.statusCode).toBe("number");
      }
    });

    it("typeUri が https://api.otography.com/errors/{slug} 形式である", () => {
      for (const entry of ERROR_TYPES) {
        expect(entry.typeUri).toBe(`https://api.otography.com/errors/${entry.slug}`);
      }
    });
  });

  describe("getBySlug の検証", () => {
    it("既知の slug で正しいエントリを返す", () => {
      const entry = getBySlug("artist-already-exists");
      expect(entry).toBeDefined();
      expect(entry!.slug).toBe("artist-already-exists");
      expect(entry!.statusCode).toBe(409);
    });

    it("未知の slug で undefined を返す", () => {
      expect(getBySlug("nonexistent-error")).toBeUndefined();
    });
  });

  describe("getAllSlugs の検証", () => {
    it("全20の slug の配列を返す", () => {
      const slugs = getAllSlugs();
      expect(slugs).toHaveLength(20);
      for (const slug of ALL_SLUGS) {
        expect(slugs).toContain(slug);
      }
    });
  });

  describe("各エラー型のステータスコード検証", () => {
    it.each([
      ["email-already-registered", 409],
      ["username-already-taken", 409],
      ["artist-already-exists", 409],
      ["song-already-exists", 409],
      ["favorite-artist-already-exists", 409],
      ["favorite-song-already-exists", 409],
      ["account-conflict", 409],
      ["profile-not-set-up", 404],
      ["post-not-found", 404],
      ["artist-not-found", 404],
      ["song-not-found", 404],
      ["session-expired", 401],
      ["session-revoked", 401],
      ["session-invalid", 401],
      ["account-disabled", 403],
      ["rate-limit-exceeded", 429],
      ["oauth-exchange-failed", 502],
      ["google-token-exchange-failed", 502],
      ["firebase-idp-signin-failed", 502],
      ["auth-service-unavailable", 503],
    ] as const)("%s → statusCode %i", (slug, expectedStatus) => {
      const entry = getBySlug(slug);
      expect(entry).toBeDefined();
      expect(entry!.statusCode).toBe(expectedStatus);
    });
  });

  describe("typeUri の一意性", () => {
    it("全 typeUri が一意である", () => {
      const typeUris = ERROR_TYPES.map((e) => e.typeUri);
      expect(new Set(typeUris).size).toBe(typeUris.length);
    });
  });

  describe("getProblemTypeUri の検証", () => {
    it("既知の slug で正しい typeUri 文字列を返す", () => {
      expect(getProblemTypeUri("artist-already-exists")).toBe(
        "https://api.otography.com/errors/artist-already-exists",
      );
      expect(getProblemTypeUri("post-not-found")).toBe(
        "https://api.otography.com/errors/post-not-found",
      );
      expect(getProblemTypeUri("session-expired")).toBe(
        "https://api.otography.com/errors/session-expired",
      );
    });
  });

  describe("汎用 Problem Details 型", () => {
    it("bad-request の status/title/typeUri を registry から取得できる", () => {
      expect(getProblemType("bad-request")).toMatchObject({
        slug: "bad-request",
        statusCode: 400,
        title: "Bad Request",
        typeUri: "https://api.otography.com/errors/bad-request",
      });
    });
  });

  describe("Postgres constraint registry", () => {
    it("constraint 名から domain error type を取得できる", () => {
      expect(getPostgresConstraint("songs_apple_music_id_key")).toMatchObject({
        constraintName: "songs_apple_music_id_key",
        message: "Apple Music ID is already registered for another song.",
        errorSlug: "song-already-exists",
      });
    });

    it("全 constraint 名が一意である", () => {
      const names = POSTGRES_CONSTRAINTS.map((entry) => entry.constraintName);
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
