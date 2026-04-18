import type { Ai } from "@cloudflare/workers-types";
import * as errore from "errore";

// Workers AI embedding生成時のエラー
class EmbeddingError extends errore.createTaggedError({
  name: "EmbeddingError",
  message: "$reason",
}) {}

// Qwen3-Embedding-0.6B モデルID
const MODEL_ID = "@cf/qwen/qwen3-embedding-0.6b" as const;

// 入力テキストの最大文字数
// CJK テキストの場合、1トークン ≈ 2文字として計算
// 4096トークン ≈ 8000文字
const MAX_INPUT_LENGTH = 8000;

// 期待されるベクトル次元数
const EMBEDDING_DIMENSIONS = 1024;

// テキストからembeddingベクトルを生成する
// 空文字・空白のみの場合はnullを返し、AIを呼び出さない
// AI呼び出し失敗時はEmbeddingErrorを返す（throwしない）
export const generateEmbedding = async (
  text: string,
  ai: Ai,
): Promise<number[] | null | EmbeddingError> => {
  // 空文字・空白のみの場合はAIを呼び出さずnullを返す
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 長すぎるテキストは切り詰める（CJK: 4096トークン ≈ 8000文字）
  const input = trimmed.length > MAX_INPUT_LENGTH ? trimmed.slice(0, MAX_INPUT_LENGTH) : trimmed;

  // Workers AI で embedding を生成
  const response = await ai
    .run(MODEL_ID, { text: [input] })
    .catch((e) => new EmbeddingError({ reason: "AI呼び出しに失敗しました", cause: e }));
  if (response instanceof EmbeddingError) return response;

  // レスポンスの検証: data配列が存在し、最初の要素が配列であること
  if (!response?.data?.[0] || !Array.isArray(response.data[0])) {
    return new EmbeddingError({ reason: "AIからのレスポンス形式が不正です" });
  }

  const embedding = response.data[0];

  // 次元数の検証
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    return new EmbeddingError({
      reason: `ベクトル次元数が不正です: 期待値=${EMBEDDING_DIMENSIONS}, 実際=${embedding.length}`,
    });
  }

  // 全ての値が有限数であることを検証
  if (!embedding.every((v) => typeof v === "number" && Number.isFinite(v))) {
    return new EmbeddingError({ reason: "ベクトルに不正な値（NaN/Infinity）が含まれています" });
  }

  return embedding;
};

export { EmbeddingError };
