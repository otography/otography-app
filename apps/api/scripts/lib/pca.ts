/**
 * 主成分分析（PCA）。n 本の D 次元ベクトルから、分散の大きい k 方向と、その方向の分散を求める。
 * D = 2048、k = 256 を想定し、共分散行列を作ってから、部分空間反復とヤコビ法で上位の固有ベクトルを求める。
 */

/** 平均と共分散行列（D × D、行優先）。 */
export function covariance(rows: Array<Float32Array>, d: number) {
  const n = rows.length;
  const mean = new Float64Array(d);
  for (const row of rows) {
    for (let j = 0; j < d; j++) {
      mean[j] += (row[j] ?? 0) / n;
    }
  }
  const c = new Float64Array(d * d);
  const centered = new Float64Array(d);
  for (const row of rows) {
    for (let j = 0; j < d; j++) {
      centered[j] = (row[j] ?? 0) - mean[j];
    }
    for (let i = 0; i < d; i++) {
      const ci = centered[i];
      const base = i * d;
      for (let j = i; j < d; j++) {
        c[base + j] += ci * centered[j];
      }
    }
  }
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      const v = c[i * d + j] / n;
      c[i * d + j] = v;
      c[j * d + i] = v;
    }
  }
  return { mean, c };
}

/** 列ベクトル p 本（D × p、列優先）を、修正グラム・シュミット法で正規直交化する。 */
function orthonormalize(q: Float64Array, d: number, p: number) {
  for (let a = 0; a < p; a++) {
    const qa = q.subarray(a * d, (a + 1) * d);
    for (let b = 0; b < a; b++) {
      const qb = q.subarray(b * d, (b + 1) * d);
      let dot = 0;
      for (let i = 0; i < d; i++) {
        dot += qa[i] * qb[i];
      }
      for (let i = 0; i < d; i++) {
        qa[i] -= dot * qb[i];
      }
    }
    let norm = 0;
    for (let i = 0; i < d; i++) {
      norm += qa[i] * qa[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < d; i++) {
      qa[i] /= norm;
    }
  }
}

/** 対称行列 C（D × D）と列優先の Q（D × p）の積。結果も列優先。 */
function multiply(c: Float64Array, q: Float64Array, d: number, p: number) {
  const out = new Float64Array(d * p);
  for (let a = 0; a < p; a++) {
    const qa = q.subarray(a * d, (a + 1) * d);
    const oa = out.subarray(a * d, (a + 1) * d);
    for (let i = 0; i < d; i++) {
      const row = i * d;
      let acc = 0;
      for (let j = 0; j < d; j++) {
        acc += c[row + j] * qa[j];
      }
      oa[i] = acc;
    }
  }
  return out;
}

/** 対称行列（m × m）の固有分解（ヤコビ法）。固有値の大きい順に返す。vectors は列優先。 */
function jacobi(matrix: Float64Array, m: number) {
  const a = Float64Array.from(matrix);
  const v = new Float64Array(m * m);
  for (let i = 0; i < m; i++) {
    v[i * m + i] = 1;
  }
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let i = 0; i < m; i++) {
      for (let j = i + 1; j < m; j++) {
        off += a[i * m + j] ** 2;
      }
    }
    if (off < 1e-22) {
      break;
    }
    for (let p = 0; p < m; p++) {
      for (let q = p + 1; q < m; q++) {
        const apq = a[p * m + q];
        if (Math.abs(apq) < 1e-30) {
          continue;
        }
        const theta = (a[q * m + q] - a[p * m + p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const cos = 1 / Math.sqrt(t * t + 1);
        const sin = t * cos;
        for (let k = 0; k < m; k++) {
          const akp = a[k * m + p];
          const akq = a[k * m + q];
          a[k * m + p] = cos * akp - sin * akq;
          a[k * m + q] = sin * akp + cos * akq;
        }
        for (let k = 0; k < m; k++) {
          const apk = a[p * m + k];
          const aqk = a[q * m + k];
          a[p * m + k] = cos * apk - sin * aqk;
          a[q * m + k] = sin * apk + cos * aqk;
        }
        for (let k = 0; k < m; k++) {
          const vkp = v[k * m + p];
          const vkq = v[k * m + q];
          v[k * m + p] = cos * vkp - sin * vkq;
          v[k * m + q] = sin * vkp + cos * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: m }, (_, i) => i).sort((x, y) => a[y * m + y] - a[x * m + x]);
  return { values: order.map((i) => a[i * m + i]), vectors: v, order };
}

/**
 * 共分散行列 C の上位 k 個の固有値と固有ベクトル。
 * 部分空間反復（k + 32 本）で上位の部分空間を求め、その中でヤコビ法を使う（レイリー・リッツ法）。
 */
export function topEigen(c: Float64Array, d: number, k: number, iterations = 20) {
  const p = Math.min(d, k + 32);
  let seed = 12_345;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648 - 0.5;
  };
  let q = Float64Array.from({ length: d * p }, random);
  orthonormalize(q, d, p);
  for (let it = 0; it < iterations; it++) {
    q = multiply(c, q, d, p);
    orthonormalize(q, d, p);
  }
  const cq = multiply(c, q, d, p);
  const t = new Float64Array(p * p);
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      let dot = 0;
      for (let i = 0; i < d; i++) {
        dot += q[a * d + i] * cq[b * d + i];
      }
      t[a * p + b] = dot;
    }
  }
  const { values, vectors, order } = jacobi(t, p);
  // 固有ベクトル u_r = Q v_r（D 次元）を、行優先で k 本並べる。
  const u = new Float64Array(k * d);
  for (let r = 0; r < k; r++) {
    const col = order[r];
    for (let i = 0; i < d; i++) {
      let acc = 0;
      for (let a = 0; a < p; a++) {
        acc += q[a * d + i] * vectors[a * p + col];
      }
      u[r * d + i] = acc;
    }
  }
  return { values: values.slice(0, k), vectors: u };
}

export type Transform = { a: Float32Array; b: Float32Array };

/**
 * x の集まりから、射影だけの変換（A = Uᵀ）と、白色化の変換（A = (Λ + τI)^(-1/2) Uᵀ）を作る。b = −Aμ。
 * τ は全次元の平均の分散。件数が少なく、分散の小さい方向の推定が不安定なので、足してから割る（収縮）。
 */
export function fitTransforms(rows: Array<Float32Array>, D: number, K: number) {
  const { mean, c } = covariance(rows, D);
  const { values, vectors } = topEigen(c, D, K);
  let total = 0;
  for (let i = 0; i < D; i++) {
    total += c[i * D + i];
  }
  const tau = total / D;
  const build = (scaleOf: (r: number) => number): Transform => {
    const a = new Float32Array(K * D);
    const b = new Float32Array(K);
    for (let r = 0; r < K; r++) {
      const scale = scaleOf(r);
      let bias = 0;
      for (let j = 0; j < D; j++) {
        const v = vectors[r * D + j] * scale;
        a[r * D + j] = v;
        bias -= v * mean[j];
      }
      b[r] = bias;
    }
    return { a, b };
  };
  return {
    explained: values.reduce((s, v) => s + v, 0) / total,
    pca: build(() => 1),
    white: build((r) => 1 / Math.sqrt(values[r] + tau)),
  };
}
