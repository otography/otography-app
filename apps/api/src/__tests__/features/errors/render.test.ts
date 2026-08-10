/**
 * テストリスト: renderErrorDocHtml の HTML エスケープ
 *
 * 1. title/description に HTML 特殊文字が含まれていても、生の <script> タグとして
 *    出力されない（エスケープされる）
 */
import { describe, expect, it } from "vitest";
import { renderErrorDocHtml } from "../../../features/errors/render";

describe("renderErrorDocHtml", () => {
  it("title/description の HTML 特殊文字をエスケープする（XSS 対策）", () => {
    const html = renderErrorDocHtml({
      typeUri: "https://api.otography.com/errors/example",
      title: '<script>alert("xss")</script>',
      description: "<img src=x onerror=alert(1)>",
      statusCode: 400,
    });

    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
