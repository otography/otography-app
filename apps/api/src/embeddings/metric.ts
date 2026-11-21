import { EMBEDDING_DIMENSIONS } from "db/constants";

/**
 * 統計（z の平均と共分散）から作った計量。バッチがリフレッシュのたびに作り直す。
 * まだ一度もリフレッシュしていない間（補正なし）は、計量の代わりに null を使う。
 */
export type Metric = {
  version: number;
  /** 平均 m。長さ EMBEDDING_DIMENSIONS */
  mean: Float32Array;
  /** 逆共分散 P = C⁻¹。EMBEDDING_DIMENSIONS × EMBEDDING_DIMENSIONS を行優先で並べたもの */
  precision: Float32Array;
  /** この計量でのノルム ‖z − m‖_P を書いた列 */
  pnormColumn: "pnormA" | "pnormB";
};

/**
 * 検索のクエリ側の値を作る。
 * - u = P(z − m)：vector_top_k に渡すベクトル。並べ直しの式の内積にも使う
 * - uNorm = ‖u‖、meanDotU = ⟨m, u⟩：コサインから内積 ⟨z − m, u⟩ を組み立てるのに使う
 * - isotropicScale = √(tr(P) / k)：バッチがまだ pnorm を書いていない行で、‖z − m‖_P を
 *   ‖z − m‖ × isotropicScale で近似するのに使う
 */
export function toQuery(z: ArrayLike<number>, metric: Metric) {
  const k = EMBEDDING_DIMENSIONS;
  const centered = Float64Array.from({ length: k }, (_, j) => (z[j] ?? 0) - (metric.mean[j] ?? 0));
  const u = Array.from<number>({ length: k });
  let squaredNorm = 0;
  let meanDotU = 0;
  let trace = 0;
  for (let i = 0; i < k; i++) {
    let acc = 0;
    for (let j = 0; j < k; j++) {
      acc += (metric.precision[i * k + j] ?? 0) * (centered[j] ?? 0);
    }
    u[i] = acc;
    squaredNorm += acc * acc;
    meanDotU += (metric.mean[i] ?? 0) * acc;
    trace += metric.precision[i * k + i] ?? 0;
  }
  return {
    u,
    uNorm: Math.sqrt(squaredNorm),
    meanDotU,
    isotropicScale: Math.sqrt(trace / k),
  };
}
