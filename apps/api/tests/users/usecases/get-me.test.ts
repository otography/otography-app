import { describe, expect, test } from "vite-plus/test";
import type { SessionUser } from "../../../src/auth/session.ts";
import { getMe } from "../../../src/users/usecases/get-me.ts";

const user = {
  id: "internal-id",
  name: "テスト",
  email: "a@example.com",
  emailVerified: true,
  image: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  publicId: "abc123def456",
  bio: undefined,
  suspendedAt: null,
  deletedAt: null,
} as unknown as SessionUser;

describe("getMe", () => {
  test("公開する項目だけを返し、undefined の項目は null にする", () => {
    expect(getMe({ user })).toEqual({
      name: "テスト",
      email: "a@example.com",
      image: null,
      publicId: "abc123def456",
      bio: null,
    });
  });
});
