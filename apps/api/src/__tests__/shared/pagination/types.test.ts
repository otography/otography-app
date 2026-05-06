import { describe, expect, it } from "vitest";
import type { ArkErrors } from "arktype";
import {
  buildPaginationMeta,
  cursorSchema,
  normalizeLimit,
  paginationInputSchema,
  trimItems,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../../shared/pagination";

const isArkErrors = (v: unknown): v is ArkErrors => Array.isArray(v) && "summary" in (v as object);

describe("normalizeLimit", () => {
  it("未指定時はデフォルト値を返す", () => {
    expect(normalizeLimit()).toBe(DEFAULT_LIMIT);
    expect(normalizeLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(normalizeLimit(null as unknown as undefined)).toBe(DEFAULT_LIMIT);
  });

  it("1以上の値をそのまま返す", () => {
    expect(normalizeLimit(1)).toBe(1);
    expect(normalizeLimit(50)).toBe(50);
  });

  it("上限をMAX_LIMITにクリップする", () => {
    expect(normalizeLimit(MAX_LIMIT)).toBe(MAX_LIMIT);
    expect(normalizeLimit(MAX_LIMIT + 1)).toBe(MAX_LIMIT);
    expect(normalizeLimit(9999)).toBe(MAX_LIMIT);
  });

  it("0や負数は1にクリップする", () => {
    expect(normalizeLimit(0)).toBe(1);
    expect(normalizeLimit(-5)).toBe(1);
  });
});

describe("buildPaginationMeta", () => {
  const makeItem = (id: string, createdAt: Date) => ({ id, createdAt, content: "test" });

  it("items が requestedLimit 以下なら hasNext=false", () => {
    const items = [makeItem("a", new Date()), makeItem("b", new Date())];

    const meta = buildPaginationMeta(items, 2);

    expect(meta.hasNext).toBe(false);
    expect(meta.nextCursor).toBeNull();
  });

  it("items が requestedLimit + 1 件なら hasNext=true、カーソルは最後から2番目", () => {
    const date1 = new Date("2026-01-01T00:00:00Z");
    const date2 = new Date("2026-01-02T00:00:00Z");
    const date3 = new Date("2026-01-03T00:00:00Z");
    const items = [makeItem("a", date1), makeItem("b", date2), makeItem("c", date3)];

    // limit=2 → 3件取得 → hasNext=true, cursor = items[1]
    const meta = buildPaginationMeta(items, 2);

    expect(meta.hasNext).toBe(true);
    expect(meta.nextCursor).toEqual({
      createdAt: date2.toISOString(),
      id: "b",
    });
  });

  it("items が空なら hasNext=false", () => {
    const meta = buildPaginationMeta([], 20);

    expect(meta.hasNext).toBe(false);
    expect(meta.nextCursor).toBeNull();
  });
});

describe("trimItems", () => {
  it("requestedLimit 以内ならそのまま返す", () => {
    const items = [1, 2, 3];

    expect(trimItems(items, 3)).toEqual([1, 2, 3]);
    expect(trimItems(items, 5)).toEqual([1, 2, 3]);
  });

  it("requestedLimit + 1 件なら先頭 requestedLimit 件に切り捨て", () => {
    const items = [1, 2, 3];

    expect(trimItems(items, 2)).toEqual([1, 2]);
  });
});

describe("cursorSchema (arktype)", () => {
  it("有効なカーソルを受け入れる", () => {
    const result = cursorSchema({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "019f1234-5678-7000-8000-123456789abc",
    });

    expect(result).not.toBeInstanceOf(Error);
  });

  it("不正な id を拒否する", () => {
    const result = cursorSchema({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "not-a-uuid",
    });

    expect(isArkErrors(result)).toBe(true);
  });
});

describe("paginationInputSchema (arktype)", () => {
  it("limit と cursor 両方なしを許可する", () => {
    const result = paginationInputSchema({});

    expect(result).not.toBeInstanceOf(Error);
  });

  it("limit と cursor 両方ありを許可する", () => {
    const result = paginationInputSchema({
      limit: 10,
      cursor: { createdAt: "2026-01-01T00:00:00.000Z", id: "019f1234-5678-7000-8000-123456789abc" },
    });

    expect(result).not.toBeInstanceOf(Error);
  });

  it("limit=0 を拒否する", () => {
    const result = paginationInputSchema({ limit: 0 });

    expect(isArkErrors(result)).toBe(true);
  });

  it("limit=101 を拒否する", () => {
    const result = paginationInputSchema({ limit: 101 });

    expect(isArkErrors(result)).toBe(true);
  });

  it("limit=100 を許可する", () => {
    const result = paginationInputSchema({ limit: 100 });

    expect(result).not.toBeInstanceOf(Error);
  });
});
