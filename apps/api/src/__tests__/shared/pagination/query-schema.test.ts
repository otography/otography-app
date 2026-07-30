import { describe, expect, it } from "vitest";
import type { ArkErrors } from "arktype";
import { paginationQuerySchema } from "../../../shared/pagination";

const isArkErrors = (v: unknown): v is ArkErrors => Array.isArray(v) && "summary" in (v as object);

const VALID_UUID = "019f1234-5678-7000-8000-123456789abc";
const ISO_DATE = "2026-01-01T00:00:00.000Z";
const PG_DATE = "2026-01-01 00:00:00.123+00";

describe("paginationQuerySchema", () => {
  it("空オブジェクトを許可する（limit/cursor とも undefined）", () => {
    const result = paginationQuerySchema({});

    expect(isArkErrors(result)).toBe(false);
    expect(result).toEqual({ limit: undefined, cursor: undefined });
  });

  it('limit: "20" を数値 20 にモーフする', () => {
    const result = paginationQuerySchema({ limit: "20" });

    expect(isArkErrors(result)).toBe(false);
    expect(result).toMatchObject({ limit: 20 });
  });

  it.each(["100"])('limit: "%s" を許可する（上限境界）', (limit) => {
    const result = paginationQuerySchema({ limit });
    expect(isArkErrors(result)).toBe(false);
  });

  it.each(["101", "0", "-1"])('limit: "%s" を拒否する（範囲外）', (limit) => {
    const result = paginationQuerySchema({ limit });
    expect(isArkErrors(result)).toBe(true);
  });

  it.each(["abc", "1.5", ""])('limit: "%s" を拒否する（非整数）', (limit) => {
    const result = paginationQuerySchema({ limit });
    expect(isArkErrors(result)).toBe(true);
  });

  it("cursor 両方有効（ISO 形式）→ { cursor: { createdAt, id } } に整形する", () => {
    const result = paginationQuerySchema({
      "cursor[createdAt]": ISO_DATE,
      "cursor[id]": VALID_UUID,
    });

    expect(isArkErrors(result)).toBe(false);
    expect(result).toMatchObject({ cursor: { createdAt: ISO_DATE, id: VALID_UUID } });
  });

  it("cursor createdAt が pg テキスト形式（2026-01-01 00:00:00.123+00）を許可する（ラウンドトリップ回帰）", () => {
    const result = paginationQuerySchema({
      "cursor[createdAt]": PG_DATE,
      "cursor[id]": VALID_UUID,
    });

    expect(isArkErrors(result)).toBe(false);
  });

  it("cursor[createdAt] のみ指定 → 拒否する", () => {
    const result = paginationQuerySchema({
      "cursor[createdAt]": ISO_DATE,
    });

    expect(isArkErrors(result)).toBe(true);
  });

  it("cursor[id] のみ指定 → 拒否する", () => {
    const result = paginationQuerySchema({
      "cursor[id]": VALID_UUID,
    });

    expect(isArkErrors(result)).toBe(true);
  });

  it('cursor[createdAt]: "garbage" → 拒否する', () => {
    const result = paginationQuerySchema({
      "cursor[createdAt]": "garbage",
      "cursor[id]": VALID_UUID,
    });

    expect(isArkErrors(result)).toBe(true);
  });

  it('cursor[id]: "not-a-uuid" → 拒否する', () => {
    const result = paginationQuerySchema({
      "cursor[createdAt]": ISO_DATE,
      "cursor[id]": "not-a-uuid",
    });

    expect(isArkErrors(result)).toBe(true);
  });

  it("limit + cursor 併用 → 許可する", () => {
    const result = paginationQuerySchema({
      limit: "2",
      "cursor[createdAt]": ISO_DATE,
      "cursor[id]": VALID_UUID,
    });

    expect(isArkErrors(result)).toBe(false);
    expect(result).toMatchObject({
      limit: 2,
      cursor: { createdAt: ISO_DATE, id: VALID_UUID },
    });
  });
});
