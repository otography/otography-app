import { posts, reports, users } from "db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { Database } from "../../src/lib/db.ts";
import { ReportTargetNotFoundError, SelfReportError } from "../../src/reports/errors.ts";
import { createReportInput } from "../../src/reports/schemas.ts";
import { createReport } from "../../src/reports/usecases/create-report.ts";
import { createTestDb } from "../helpers/db.ts";

let db: Database;
const input = (value: unknown) => createReportInput.parse(value);

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "author", name: "投稿者", email: "a@example.com", publicId: "author000001" },
    { id: "reporter", name: "通報者", email: "b@example.com", publicId: "reporter0001" },
  ]);
  await db.insert(posts).values({ id: "post1", userId: "author", content: "本文" });
});

describe("createReportInput", () => {
  test("対象は投稿かユーザーのどちらか 1 つだけ", () => {
    expect(createReportInput.safeParse({ reason: "spam", postId: "p" }).success).toBe(true);
    expect(createReportInput.safeParse({ reason: "spam", publicId: "u" }).success).toBe(true);
    expect(createReportInput.safeParse({ reason: "spam" }).success).toBe(false);
    expect(
      createReportInput.safeParse({ reason: "spam", postId: "p", publicId: "u" }).success,
    ).toBe(false);
    expect(createReportInput.safeParse({ reason: "unknown", postId: "p" }).success).toBe(false);
  });
});

describe("createReport", () => {
  test("投稿への通報は、投稿者も記録する。重ねて通報しても 1 件のまま", async () => {
    const report = input({ reason: "spam", postId: "post1", detail: "  宣伝です  " });
    expect(await createReport({ db, reporterId: "reporter", input: report })).toBeNull();
    expect(await createReport({ db, reporterId: "reporter", input: report })).toBeNull();

    expect(await db.select().from(reports)).toMatchObject([
      {
        reporterId: "reporter",
        postId: "post1",
        targetUserId: "author",
        reason: "spam",
        detail: "宣伝です",
        status: "open",
      },
    ]);
  });

  test("ユーザーへの通報は、投稿への通報とは別に数える", async () => {
    await createReport({
      db,
      reporterId: "reporter",
      input: input({ reason: "spam", postId: "post1" }),
    });
    await createReport({
      db,
      reporterId: "reporter",
      input: input({ reason: "impersonation", publicId: "author000001" }),
    });
    expect(await db.select().from(reports)).toHaveLength(2);
  });

  test("処理済みになった後は、同じ対象をもう一度通報できる", async () => {
    const report = input({ reason: "spam", publicId: "author000001" });
    await createReport({ db, reporterId: "reporter", input: report });
    await db.update(reports).set({ status: "dismissed" });
    await createReport({ db, reporterId: "reporter", input: report });
    expect(await db.select().from(reports)).toHaveLength(2);
  });

  test("自分は通報できず、無い投稿・非表示の投稿は見つからない", async () => {
    expect(
      await createReport({
        db,
        reporterId: "author",
        input: input({ reason: "spam", postId: "post1" }),
      }),
    ).toBeInstanceOf(SelfReportError);
    expect(
      await createReport({
        db,
        reporterId: "reporter",
        input: input({ reason: "spam", postId: "x" }),
      }),
    ).toBeInstanceOf(ReportTargetNotFoundError);
    await db.update(posts).set({ hiddenAt: new Date() }).where(eq(posts.id, "post1"));
    expect(
      await createReport({
        db,
        reporterId: "reporter",
        input: input({ reason: "spam", postId: "post1" }),
      }),
    ).toBeInstanceOf(ReportTargetNotFoundError);
  });
});
