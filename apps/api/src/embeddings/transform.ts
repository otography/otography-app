import { embeddingTransforms } from "db";
import { EMBEDDING_DIMENSIONS, EMBEDDING_INPUT_DIMENSIONS } from "db/constants";
import { eq } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { EmbeddingTransformError } from "./errors.ts";
import { bytesToFloat32 } from "./vectors.ts";

/** 変換 z = Ax + b。a は A を行優先で並べたもの（EMBEDDING_DIMENSIONS × EMBEDDING_INPUT_DIMENSIONS）。 */
export type Transform = { model: string; a: Float32Array; b: Float32Array };

/** x を z に落とし、z と ‖z‖ を返す。 */
export function project(transform: Transform, x: ArrayLike<number>) {
  const k = EMBEDDING_DIMENSIONS;
  const d = EMBEDDING_INPUT_DIMENSIONS;
  const z = Array.from<number>({ length: k });
  let squared = 0;
  for (let i = 0; i < k; i++) {
    let acc = transform.b[i] ?? 0;
    const row = i * d;
    for (let j = 0; j < d; j++) {
      acc += (transform.a[row + j] ?? 0) * (x[j] ?? 0);
    }
    z[i] = acc;
    squared += acc * acc;
  }
  return { z, norm: Math.sqrt(squared) };
}

/** model の変換を読む。まだ作っていなければ null。 */
export async function loadTransform({ db, model }: { db: Database; model: string }) {
  const row = await db
    .select({ a: embeddingTransforms.a, b: embeddingTransforms.b })
    .from(embeddingTransforms)
    .where(eq(embeddingTransforms.model, model))
    .get()
    .catch((error: unknown) => new EmbeddingTransformError({ model, cause: error }));
  if (row instanceof Error) {
    return row;
  }
  if (!row) {
    return null;
  }
  const transform = { model, a: bytesToFloat32(row.a), b: bytesToFloat32(row.b) };
  if (
    transform.a.length !== EMBEDDING_DIMENSIONS * EMBEDDING_INPUT_DIMENSIONS ||
    transform.b.length !== EMBEDDING_DIMENSIONS
  ) {
    return new EmbeddingTransformError({
      model,
      cause: new Error("変換の大きさが次元数と合わない"),
    });
  }
  return transform;
}
