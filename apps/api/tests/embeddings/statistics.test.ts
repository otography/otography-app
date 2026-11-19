import { EMBEDDING_DIMENSIONS } from "db/constants";
import { describe, expect, test } from "vite-plus/test";
import {
  accumulate,
  emptyMoments,
  geometryFromPrecision,
  momentsCount,
  precisionNorm,
  toGeometry,
} from "../../src/embeddings/statistics.ts";
import { createGaussian } from "../helpers/random.ts";

const k = EMBEDDING_DIMENSIONS;
const gaussian = createGaussian(7);
// 次元ごとに広がりが違い、平均が 0 でないデータ
const sample = () => Array.from({ length: k }, (_, i) => 0.3 + gaussian() * (0.5 + i / k));
const data = Array.from({ length: 600 }, sample);

const fromData = (rows: number[][]) => {
  const moments = emptyMoments();
  for (const z of rows) accumulate(moments, z, 1);
  return moments;
};

describe("statistics", () => {
  test("平均と、共分散の逆行列を求める", () => {
    const geometry = toGeometry(fromData(data));
    if (!geometry) throw new Error("計量を作れなかった");
    const n = data.length;
    const mean = Array.from({ length: k }, (_, i) => data.reduce((s, z) => s + z[i]!, 0) / n);
    expect(Math.max(...mean.map((m, i) => Math.abs(m - geometry.mean[i]!)))).toBeLessThan(1e-9);

    // P C = I を確かめる（C はデータから直接求める）
    const C = new Float64Array(k * k);
    for (const z of data) {
      for (let i = 0; i < k; i++) {
        const di = z[i]! - mean[i]!;
        for (let j = 0; j < k; j++) C[i * k + j]! += (di * (z[j]! - mean[j]!)) / n;
      }
    }
    let worst = 0;
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        let s = 0;
        for (let p = 0; p < k; p++) s += geometry.precision[i * k + p]! * C[p * k + j]!;
        worst = Math.max(worst, Math.abs(s - (i === j ? 1 : 0)));
      }
    }
    expect(worst).toBeLessThan(1e-6);
  }, 30_000);

  test("足した行を引くと、足す前の統計に戻る", () => {
    const moments = fromData(data);
    const extra = sample();
    accumulate(moments, extra, 1);
    accumulate(moments, extra, -1);
    const expected = fromData(data);
    expect(momentsCount(moments)).toBe(data.length);
    expect(Math.max(...moments.map((v, i) => Math.abs(v - expected[i]!)))).toBeLessThan(1e-9);
  });

  test("保存した平均と P から作り直した計量でも、同じノルムになる", () => {
    const geometry = toGeometry(fromData(data));
    if (!geometry) throw new Error("計量を作れなかった");
    const restored = geometryFromPrecision(geometry.mean, geometry.precision);
    if (!restored) throw new Error("計量を作り直せなかった");
    const z = sample();
    expect(precisionNorm(z, restored)).toBeCloseTo(precisionNorm(z, geometry), 6);
  });

  test("行数が次元数以下なら、計量を作らない", () => {
    expect(toGeometry(fromData(data.slice(0, k)))).toBeNull();
  });
});
