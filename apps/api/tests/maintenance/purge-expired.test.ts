import { likes, postIpLogs, posts, users } from "db";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { Database } from "../../src/lib/db.ts";
import { purgeExpired } from "../../src/maintenance/usecases/purge-expired.ts";
import { createTestDb } from "../helpers/db.ts";

let db: Database;
const now = new Date("2026-11-17T00:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "active", name: "利用者", email: "a@example.com", publicId: "active000001" },
    {
      id: "oldLeaver",
      name: "退会者",
      email: "b@x",
      publicId: "leaver000001",
      deletedAt: daysAgo(91),
    },
    {
      id: "newLeaver",
      name: "退会者",
      email: "c@x",
      publicId: "leaver000002",
      deletedAt: daysAgo(10),
    },
  ]);
  await db.insert(posts).values([
    { id: "kept", userId: "active", content: "残る" },
    { id: "oldDeleted", userId: "active", content: "消える", deletedAt: daysAgo(91) },
    { id: "newDeleted", userId: "active", content: "残る", deletedAt: daysAgo(10) },
    { id: "byOldLeaver", userId: "oldLeaver", content: "退会者と一緒に消える" },
  ]);
  await db.insert(likes).values({ userId: "active", postId: "oldDeleted" });
  await db.insert(postIpLogs).values([
    { postId: "kept", userId: "active", ipAddress: "203.0.113.1", createdAt: daysAgo(91) },
    { postId: "newDeleted", userId: "active", ipAddress: "203.0.113.2", createdAt: daysAgo(10) },
  ]);
});

describe("purgeExpired", () => {
  test("90 日を過ぎた退会者・削除した投稿・IP ログだけを消し、子の行も消える", async () => {
    expect(await purgeExpired({ db, now })).toEqual({
      users: 1,
      posts: 1,
      ipLogs: 1,
      similarCaches: 0,
    });

    expect((await db.select().from(users)).map((u) => u.id).sort()).toEqual([
      "active",
      "newLeaver",
    ]);
    expect((await db.select().from(posts)).map((p) => p.id).sort()).toEqual(["kept", "newDeleted"]);
    expect(await db.select().from(likes)).toHaveLength(0);
    expect((await db.select().from(postIpLogs)).map((l) => l.postId)).toEqual(["newDeleted"]);
  });
});
