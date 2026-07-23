import { describe, expect, it } from "vitest";
import type { ArkErrors } from "arktype";
import {
  buildPaginationMeta,
  createPage,
  cursorSchema,
  normalizeLimit,
  paginationInputSchema,
  parsePaginationQuery,
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
  const makeItem = (id: string, createdAt: string) => ({ id, createdAt, content: "test" });

  it("items が requestedLimit 以下なら hasNext=false", () => {
    const items = [
      makeItem("a", new Date().toISOString()),
      makeItem("b", new Date().toISOString()),
    ];

    const meta = buildPaginationMeta(items, 2);

    expect(meta.hasNext).toBe(false);
    expect(meta.nextCursor).toBeNull();
  });

  it("items が requestedLimit + 1 件なら hasNext=true、カーソルは最後から2番目", () => {
    const date1 = "2026-01-01T00:00:00.000Z";
    const date2 = "2026-01-02T00:00:00.000Z";
    const date3 = "2026-01-03T00:00:00.000Z";
    const items = [makeItem("a", date1), makeItem("b", date2), makeItem("c", date3)];

    // limit=2 → 3件取得 → hasNext=true, cursor = items[1]
    const meta = buildPaginationMeta(items, 2);

    expect(meta.hasNext).toBe(true);
    expect(meta.nextCursor).toEqual({
      createdAt: date2,
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

describe("createPage", () => {
  it("derives metadata from source rows before mapping the visible items", () => {
    const rows = [
      { id: "3", createdAt: "2026-01-03", value: 30 },
      { id: "2", createdAt: "2026-01-02", value: 20 },
      { id: "1", createdAt: "2026-01-01", value: 10 },
    ];

    expect(createPage(rows, 2, (row) => row.value)).toEqual({
      items: [30, 20],
      pagination: {
        hasNext: true,
        nextCursor: { id: "2", createdAt: "2026-01-02" },
      },
    });
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

describe("parsePaginationQuery", () => {
  it.each(["abc", "10abc", "0", "101", "-1"])("limit=%s を拒否する", (limit) => {
    const result = parsePaginationQuery({
      req: { query: (key) => (key === "limit" ? limit : undefined) },
    });

    expect(isArkErrors(result)).toBe(true);
  });

  it("片方だけのcursorを拒否する", () => {
    const result = parsePaginationQuery({
      req: {
        query: (key) => (key === "cursor[createdAt]" ? "2026-01-01T00:00:00.000Z" : undefined),
      },
    });

    expect(isArkErrors(result)).toBe(true);
  });
});
