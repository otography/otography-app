/**
 * 統計のバッチで使う、小さな密行列の計算。行列は n × n を行優先で Float64Array に並べる。
 */

/** 対称正定値行列 a のコレスキー分解 a = L Lᵀ。L は下三角。正定値でなければ null。 */
export function cholesky(a: Float64Array, n: number) {
  const l = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = a[i * n + j] ?? 0;
      for (let p = 0; p < j; p++) {
        sum -= (l[i * n + p] ?? 0) * (l[j * n + p] ?? 0);
      }
      if (i === j) {
        if (!(sum > 0)) {
          return null;
        }
        l[i * n + i] = Math.sqrt(sum);
      } else {
        l[i * n + j] = sum / (l[j * n + j] ?? 1);
      }
    }
  }
  return l;
}

/** 下三角行列 l の逆行列（これも下三角）。 */
export function invertLower(l: Float64Array, n: number) {
  const inv = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    inv[j * n + j] = 1 / (l[j * n + j] ?? 1);
    for (let i = j + 1; i < n; i++) {
      let sum = 0;
      for (let p = j; p < i; p++) {
        sum += (l[i * n + p] ?? 0) * (inv[p * n + j] ?? 0);
      }
      inv[i * n + j] = -sum / (l[i * n + i] ?? 1);
    }
  }
  return inv;
}

/** 下三角行列 w から wᵀw を作る。w = L⁻¹ なら、wᵀw = (L Lᵀ)⁻¹ になる。 */
export function lowerGram(w: Float64Array, n: number) {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      // w は下三角なので、行 p が i 以上の成分だけが 0 でない
      for (let p = i; p < n; p++) {
        sum += (w[p * n + i] ?? 0) * (w[p * n + j] ?? 0);
      }
      out[i * n + j] = sum;
      out[j * n + i] = sum;
    }
  }
  return out;
}
