import { postEmbeddings, posts, reports, sessions, users } from "db";
import { EMBEDDING_DIMENSIONS } from "db/constants";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import {
  AdminTargetNotFoundError,
  ReportNotFoundError,
  SelfSuspendError,
} from "../../src/admin/errors.ts";
import { findIsAdmin } from "../../src/admin/repository.ts";
import { listReports } from "../../src/admin/usecases/list-reports.ts";
import {
  resolveReport,
  setPostHidden,
  setUserSuspended,
} from "../../src/admin/usecases/moderate.ts";
import type { Database } from "../../src/lib/db.ts";
import { getPost } from "../../src/posts/usecases/get-post.ts";
import { createTestDb } from "../helpers/db.ts";

let db: Database;
const createdAt = new Date("2026-11-01T00:00:00Z");

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    {
      id: "admin",
      name: "管理者",
      email: "a@example.com",
      publicId: "admin0000001",
      isAdmin: true,
    },
    { id: "author", name: "投稿者", email: "b@example.com", publicId: "author000001" },
    { id: "reporter", name: "通報者", email: "c@example.com", publicId: "reporter0001" },
  ]);
  await db
    .insert(posts)
    .values({ id: "post1", userId: "author", content: "本文", createdAt, updatedAt: createdAt });
  await db.insert(reports).values({
    id: "r1",
    reporterId: "reporter",
    postId: "post1",
    targetUserId: "author",
    reason: "spam",
  });
});

describe("findIsAdmin", () => {
  test("is_admin の列で管理者かを判定する", async () => {
    expect(await findIsAdmin({ db, userId: "admin" })).toBe(true);
    expect(await findIsAdmin({ db, userId: "author" })).toBe(false);
    expect(await findIsAdmin({ db, userId: "nothing" })).toBe(false);
  });
});

describe("listReports / resolveReport", () => {
  test("未処理の通報を、通報者・対象・投稿とともに返し、処理すると一覧から外れる", async () => {
    const open = await listReports({ db, status: "open" });
    if (open instanceof Error) throw open;
    expect(open.reports).toMatchObject([
      {
        id: "r1",
        reason: "spam",
        reporter: { publicId: "reporter0001" },
        targetUser: { publicId: "author000001", suspendedAt: null },
        post: { id: "post1", content: "本文", hiddenAt: null },
      },
    ]);

    expect(await resolveReport({ db, reportId: "r1", status: "resolved" })).toEqual({
      status: "resolved",
    });
    const after = await listReports({ db, status: "open" });
    if (after instanceof Error) throw after;
    expect(after.reports).toHaveLength(0);
    expect(await resolveReport({ db, reportId: "x", status: "dismissed" })).toBeInstanceOf(
      ReportNotFoundError,
    );
  });
});

describe("setPostHidden", () => {
  test("非表示にすると見えなくなり、埋め込みを消す。updated_at は変えない。解除すると見える", async () => {
    await db.insert(postEmbeddings).values({
      postId: "post1",
      embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5),
      model: "test",
    });
    expect(await setPostHidden({ db, postId: "post1", hidden: true })).toEqual({ hidden: true });
    expect(await db.select().from(postEmbeddings)).toHaveLength(0);
    const [post] = await db.select().from(posts).where(eq(posts.id, "post1"));
    expect(post?.updatedAt).toEqual(createdAt);
    expect(await getPost({ db, postId: "post1", viewerId: "reporter" })).toBeInstanceOf(Error);

    await setPostHidden({ db, postId: "post1", hidden: false });
    expect(await getPost({ db, postId: "post1", viewerId: "reporter" })).toMatchObject({
      id: "post1",
    });
    expect(await setPostHidden({ db, postId: "x", hidden: true })).toBeInstanceOf(
      AdminTargetNotFoundError,
    );
  });
});

describe("setUserSuspended", () => {
  test("停止するとセッションを消し、自分自身は停止できない", async () => {
    await db.insert(sessions).values({
      id: "s1",
      token: "t1",
      userId: "author",
      expiresAt: new Date("2030-01-01"),
      updatedAt: new Date(),
    });
    expect(
      await setUserSuspended({ db, adminId: "admin", publicId: "author000001", suspended: true }),
    ).toEqual({ suspended: true });
    expect(await db.select().from(sessions)).toHaveLength(0);
    const [author] = await db.select().from(users).where(eq(users.id, "author"));
    expect(author?.suspendedAt).toBeInstanceOf(Date);

    await setUserSuspended({ db, adminId: "admin", publicId: "author000001", suspended: false });
    const [restored] = await db.select().from(users).where(eq(users.id, "author"));
    expect(restored?.suspendedAt).toBeNull();

    expect(
      await setUserSuspended({ db, adminId: "admin", publicId: "admin0000001", suspended: true }),
    ).toBeInstanceOf(SelfSuspendError);
    expect(
      await setUserSuspended({ db, adminId: "admin", publicId: "nobody", suspended: true }),
    ).toBeInstanceOf(AdminTargetNotFoundError);
  });
});
