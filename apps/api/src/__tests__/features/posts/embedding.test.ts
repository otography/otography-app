import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateEmbedding } from "../../../features/posts/lib/embedding";

// モック用の Ai バインディング
const mockAiRun = vi.fn();
const mockAi = { run: mockAiRun } as never;

// テスト用の 1024 次元ベクトル生成ヘルパー
const createMockEmbedding = (dimensions = 1024): number[] =>
  Array.from({ length: dimensions }, (_, i) => 0.001 * (i + 1));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateEmbedding", () => {
  describe("有効なテキスト入力", () => {
    it("1024次元のfloat配列を返す", async () => {
      const mockData = createMockEmbedding();
      mockAiRun.mockResolvedValue({ data: [mockData] });

      const result = await generateEmbedding("素晴らしい曲です", mockAi);

      expect(result).not.toBeInstanceOf(Error);
      expect(result).not.toBeNull();
      if (result !== null && !(result instanceof Error)) {
        expect(result).toHaveLength(1024);
        expect(result.every((v) => typeof v === "number" && Number.isFinite(v))).toBe(true);
      }
    });

    it("env.AI.run を正しいモデルとパラメータで呼び出す", async () => {
      const mockData = createMockEmbedding();
      mockAiRun.mockResolvedValue({ data: [mockData] });

      await generateEmbedding("テスト入力", mockAi);

      expect(mockAiRun).toHaveBeenCalledWith("@cf/qwen/qwen3-embedding-0.6b", {
        text: ["テスト入力"],
      });
    });

    it("AI呼び出しは1回だけ行う", async () => {
      mockAiRun.mockResolvedValue({ data: [createMockEmbedding()] });

      await generateEmbedding("テスト", mockAi);

      expect(mockAiRun).toHaveBeenCalledTimes(1);
    });
  });

  describe("空文字・空白のみの入力", () => {
    it("空文字列入力 → nullを返し、AIを呼び出さない", async () => {
      const result = await generateEmbedding("", mockAi);

      expect(result).toBeNull();
      expect(mockAiRun).not.toHaveBeenCalled();
    });

    it("空白のみの入力 → nullを返し、AIを呼び出さない", async () => {
      const result = await generateEmbedding("   \t\n  ", mockAi);

      expect(result).toBeNull();
      expect(mockAiRun).not.toHaveBeenCalled();
    });

    it("タブと改行のみの入力 → nullを返し、AIを呼び出さない", async () => {
      const result = await generateEmbedding("\t\t\n\n", mockAi);

      expect(result).toBeNull();
      expect(mockAiRun).not.toHaveBeenCalled();
    });
  });

  describe("長いテキストの切り詰め", () => {
    it("8000文字を超える入力 → 切り詰めてからAIを呼び出す", async () => {
      const longText = "あ".repeat(10000);
      mockAiRun.mockResolvedValue({ data: [createMockEmbedding()] });

      const result = await generateEmbedding(longText, mockAi);

      expect(result).not.toBeInstanceOf(Error);
      expect(result).not.toBeNull();

      // AIに渡されたテキストが切り詰められていることを確認
      const calledText = mockAiRun.mock.calls[0]![1] as { text: string[] };
      expect(calledText.text[0]!.length).toBeLessThanOrEqual(8000);
      expect(calledText.text[0]!.length).toBeGreaterThan(0);
    });

    it("8000文字ちょうどの入力 → そのままAIを呼び出す", async () => {
      const exactText = "a".repeat(8000);
      mockAiRun.mockResolvedValue({ data: [createMockEmbedding()] });

      const result = await generateEmbedding(exactText, mockAi);

      expect(result).not.toBeInstanceOf(Error);
      expect(result).not.toBeNull();

      const calledText = mockAiRun.mock.calls[0]![1] as { text: string[] };
      expect(calledText.text[0]!.length).toBe(8000);
    });

    it("切り詰め後も有効なembeddingを返す", async () => {
      const longText = "テスト".repeat(5000);
      mockAiRun.mockResolvedValue({ data: [createMockEmbedding()] });

      const result = await generateEmbedding(longText, mockAi);

      if (result === null || result instanceof Error) {
        expect.unreachable("Expected valid embedding");
      }
      expect(result).toHaveLength(1024);
      expect(result.every((v) => Number.isFinite(v))).toBe(true);
    });
  });

  describe("AI呼び出しエラー（graceful degradation）", () => {
    it("env.AI.run が例外をスロー → Error オブジェクトを返す（throwしない）", async () => {
      mockAiRun.mockRejectedValue(new Error("AI service unavailable"));

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
    });

    it("env.AI.run がnullを返す → Error オブジェクトを返す", async () => {
      mockAiRun.mockResolvedValue(null);

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
    });

    it("env.AI.run がdataなしのレスポンスを返す → Error オブジェクトを返す", async () => {
      mockAiRun.mockResolvedValue({ shape: [1, 1024] });

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
    });

    it("env.AI.run が空のdata配列を返す → Error オブジェクトを返す", async () => {
      mockAiRun.mockResolvedValue({ data: [] });

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
    });

    it("env.AI.run が不正な次元数のベクトルを返す → Error オブジェクトを返す", async () => {
      mockAiRun.mockResolvedValue({ data: [[0.1, 0.2, 0.3]] });

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
    });

    it("env.AI.run がNaNを含むベクトルを返す → Error オブジェクトを返す", async () => {
      const embeddingWithNaN = createMockEmbedding();
      embeddingWithNaN[0] = NaN;
      mockAiRun.mockResolvedValue({ data: [embeddingWithNaN] });

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
    });

    it("env.AI.run がInfinityを含むベクトルを返す → Error オブジェクトを返す", async () => {
      const embeddingWithInf = createMockEmbedding();
      embeddingWithInf[512] = Infinity;
      mockAiRun.mockResolvedValue({ data: [embeddingWithInf] });

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("エラーオブジェクトのプロパティ", () => {
    it("AI例外時のエラーはcauseに元のエラーを保持する", async () => {
      const originalError = new Error("Network timeout");
      mockAiRun.mockRejectedValue(originalError);

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
      if (result instanceof Error) {
        expect(result.cause).toBe(originalError);
      }
    });

    it("不正レスポンス時のエラーはcauseなしで生成される", async () => {
      mockAiRun.mockResolvedValue({ data: [] });

      const result = await generateEmbedding("テスト", mockAi);

      expect(result).toBeInstanceOf(Error);
      if (result instanceof Error) {
        expect(result.cause).toBeUndefined();
      }
    });
  });
});
