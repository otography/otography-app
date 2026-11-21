import { describe, expect, test } from "vite-plus/test";
import { covariance, topEigen } from "../../scripts/lib/pca.ts";
import { createGaussian } from "../helpers/random.ts";

describe("pca", () => {
  test("分散の大きい方向と、その分散を求める", () => {
    const gaussian = createGaussian(5);
    const d = 40;
    // 上位 5 次元の標準偏差が 5, 4, 3, 2, 1、残りが 0.3 のデータ。固有値は 25, 16, 9, 4, 1
    const rows = Array.from({ length: 4000 }, () =>
      Float32Array.from({ length: d }, (_, j) => 3 + gaussian() * (j < 5 ? 5 - j : 0.3)),
    );
    const { mean, c } = covariance(rows, d);
    expect(mean[0]).toBeCloseTo(3, 1);
    const { values, vectors } = topEigen(c, d, 5);
    for (let r = 0; r < 5; r++) {
      expect(values[r] / (5 - r) ** 2).toBeCloseTo(1, 1);
      // r 番目の固有ベクトルは、ほぼ r 番目の軸
      expect(Math.abs(vectors[r * d + r])).toBeGreaterThan(0.9);
    }
  });
});
