import { EMBEDDING_DIMENSIONS } from "db/constants";
import { cholesky, invertLower, lowerGram } from "./linear-algebra.ts";

const k = EMBEDDING_DIMENSIONS;
const K = k + 1;
/** 上三角の (i, j)（i ≤ j < K）が並びのどこにあるか。 */
const at = (i: number, j: number) => i * K - (i * (i - 1)) / 2 + (j - i);

/**
 * z の統計。Σ z̃ z̃ᵀ（z̃ = [z; 1]）の上三角を持つ。z̃ z̃ᵀ の和なので、追加は足し算、削除は引き算で済む。
 * 最後の対角成分が行数、最後の列が z の和、残りが z の 2 次の和になる。
 */
export type Moments = Float64Array;

export const emptyMoments = (): Moments => new Float64Array((K * (K + 1)) / 2);

export const momentsCount = (moments: Moments) => moments[at(k, k)] ?? 0;

/** z を 1 本足す（sign が -1 なら引く）。moments を書き換える。 */
export function accumulate(moments: Moments, z: ArrayLike<number>, sign: 1 | -1) {
  for (let i = 0; i < K; i++) {
    const zi = i < k ? (z[i] ?? 0) : 1;
    const row = at(i, i) - i;
    for (let j = i; j < K; j++) {
      const zj = j < k ? (z[j] ?? 0) : 1;
      moments[row + j] = (moments[row + j] ?? 0) + sign * zi * zj;
    }
  }
}

/** 計量。whitener W は WᵀW = P を満たす行列で、‖z − m‖_P = ‖W(z − m)‖ になる。 */
export type Geometry = {
  mean: Float64Array;
  precision: Float64Array;
  whitener: Float64Array;
};

/** 平均 m、共分散 C、P = C⁻¹ を作る。C が正定値でない（行数が少ないなど）ときは null。 */
export function toGeometry(moments: Moments): Geometry | null {
  const n = momentsCount(moments);
  if (!(n > k)) return null;
  const mean = Float64Array.from({ length: k }, (_, i) => (moments[at(i, k)] ?? 0) / n);
  const covariance = new Float64Array(k * k);
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      const c = (moments[at(i, j)] ?? 0) / n - (mean[i] ?? 0) * (mean[j] ?? 0);
      covariance[i * k + j] = c;
      covariance[j * k + i] = c;
    }
  }
  const l = cholesky(covariance, k);
  if (!l) return null;
  // C = L Lᵀ なら P = C⁻¹ = L⁻ᵀ L⁻¹ なので、W = L⁻¹ とすれば WᵀW = P になる
  const whitener = invertLower(l, k);
  return { mean, precision: lowerGram(whitener, k), whitener };
}

/** 保存した平均と P から計量を作り直す。P = L Lᵀ なら、W = Lᵀ とすれば WᵀW = P になる。 */
export function geometryFromPrecision(
  mean: Float64Array,
  precision: Float64Array,
): Geometry | null {
  const l = cholesky(precision, k);
  if (!l) return null;
  const whitener = new Float64Array(k * k);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) whitener[i * k + j] = l[j * k + i] ?? 0;
  return { mean, precision, whitener };
}

/** 計量 geometry でのノルム ‖z − m‖_P。 */
export function precisionNorm(z: ArrayLike<number>, geometry: Geometry) {
  const d = Float64Array.from({ length: k }, (_, i) => (z[i] ?? 0) - (geometry.mean[i] ?? 0));
  let sum = 0;
  for (let i = 0; i < k; i++) {
    let acc = 0;
    for (let j = 0; j < k; j++) acc += (geometry.whitener[i * k + j] ?? 0) * (d[j] ?? 0);
    sum += acc * acc;
  }
  return Math.sqrt(sum);
}

/**
 * 公開中の計量（null は補正なし、つまり m = 0、P = I）から見た、新しい計量の変化の大きさ。
 * - precisionChange：‖P_new − P_old‖_F / ‖P_old‖_F
 * - meanShift：平均の移動を新しい計量で測った長さ √((m_new − m_old)ᵀ P_new (m_new − m_old))
 */
export function drift(
  current: { mean: ArrayLike<number>; precision: ArrayLike<number> } | null,
  next: Geometry,
) {
  let diff = 0;
  let base = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const old = current ? (current.precision[i * k + j] ?? 0) : i === j ? 1 : 0;
      diff += ((next.precision[i * k + j] ?? 0) - old) ** 2;
      base += old ** 2;
    }
  }
  const shift = Float64Array.from(
    { length: k },
    (_, i) => (next.mean[i] ?? 0) - (current ? (current.mean[i] ?? 0) : 0),
  );
  let shiftNorm = 0;
  for (let i = 0; i < k; i++) {
    let acc = 0;
    for (let j = 0; j < k; j++) acc += (next.precision[i * k + j] ?? 0) * (shift[j] ?? 0);
    shiftNorm += (shift[i] ?? 0) * acc;
  }
  return { precisionChange: Math.sqrt(diff / base), meanShift: Math.sqrt(Math.max(shiftNorm, 0)) };
}
