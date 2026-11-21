import { embeddingChanges, embeddingMetrics, postEmbeddings } from "db";
import { and, asc, eq, gt, isNull, lte } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { EmbeddingMetricError } from "./errors.ts";
import type { Metric } from "./metric.ts";
import { accumulate, precisionNorm } from "./statistics.ts";
import type { Geometry, Moments } from "./statistics.ts";

/** 1 回の読み書きで扱う行数。 */
const CHUNK = 1000;

export type PnormColumn = "pnorm_a" | "pnorm_b";
const pnormColumns = { pnorm_a: postEmbeddings.pnormA, pnorm_b: postEmbeddings.pnormB } as const;

const toBytes = (a: Float64Array | Float32Array) =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
// 読み出した値は Node では Buffer で、byteOffset が 4 や 8 の倍数とは限らないので、コピーしてから型付き配列にする
const toFloat64 = (b: Uint8Array) => new Float64Array(new Uint8Array(b).buffer);
const toFloat32 = (b: Uint8Array) => new Float32Array(new Uint8Array(b).buffer);

/** model の統計の行を読む。無ければ、空の統計で作る。 */
export async function readMetricState({
  db,
  model,
  emptyMoments,
}: {
  db: Database;
  model: string;
  emptyMoments: Moments;
}) {
  const inserted = await db
    .insert(embeddingMetrics)
    .values({ model, moments: toBytes(emptyMoments) })
    .onConflictDoNothing()
    .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
  if (inserted instanceof Error) {
    return inserted;
  }

  const row = await db
    .select()
    .from(embeddingMetrics)
    .where(eq(embeddingMetrics.model, model))
    .get()
    .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
  if (row instanceof Error) {
    return row;
  }
  if (!row) {
    return new EmbeddingMetricError({ cause: new Error("統計の行を作れなかった") });
  }
  return {
    version: row.version,
    moments: toFloat64(row.moments),
    mean: row.mean ? Float64Array.from(toFloat32(row.mean)) : null,
    precision: row.precision ? Float64Array.from(toFloat32(row.precision)) : null,
    pnormColumn: row.pnormColumn,
    switchedAt: row.switchedAt,
  };
}

/**
 * 差分ログを読んで moments に足し、統計の行を更新して、読んだログを消す。
 * 統計の更新とログの削除は 1 つのトランザクション（batch）で行うので、二重に足すことはない。
 * ほかの model のログは統計に足さずに消す。取り込んだログの件数を返す。
 */
export async function consumeChanges({
  db,
  model,
  moments,
}: {
  db: Database;
  model: string;
  moments: Moments;
}) {
  let consumed = 0;
  for (;;) {
    const changes = await db
      .select()
      .from(embeddingChanges)
      .orderBy(asc(embeddingChanges.seq))
      .limit(CHUNK)
      .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
    if (changes instanceof Error) {
      return changes;
    }
    const last = changes.at(-1);
    if (!last) {
      return consumed;
    }

    for (const change of changes) {
      if (change.model !== model) {
        continue;
      }
      accumulate(moments, change.embedding, change.sign === -1 ? -1 : 1);
    }
    const saved = await db
      .batch([
        db
          .update(embeddingMetrics)
          .set({ moments: toBytes(moments) })
          .where(eq(embeddingMetrics.model, model)),
        db.delete(embeddingChanges).where(lte(embeddingChanges.seq, last.seq)),
      ])
      .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
    if (saved instanceof Error) {
      return saved;
    }
    consumed += changes.length;
  }
}

/**
 * model の埋め込みについて、計量 geometry でのノルムを column に書く。
 * onlyMissing なら、column がまだ NULL の行だけに書く。書いた行数を返す。
 * ベクトルの列ではないので、ベクトルのインデックスと差分ログのトリガーには触れない。
 */
export async function writePnorms({
  db,
  model,
  column,
  geometry,
  onlyMissing,
}: {
  db: Database;
  model: string;
  column: PnormColumn;
  geometry: Geometry;
  onlyMissing: boolean;
}) {
  const target = pnormColumns[column];
  let written = 0;
  let after = "";
  for (;;) {
    const rows = await db
      .select({ postId: postEmbeddings.postId, embedding: postEmbeddings.embedding })
      .from(postEmbeddings)
      .where(
        and(
          eq(postEmbeddings.model, model),
          gt(postEmbeddings.postId, after),
          onlyMissing ? isNull(target) : undefined,
        ),
      )
      .orderBy(asc(postEmbeddings.postId))
      .limit(CHUNK)
      .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
    if (rows instanceof Error) {
      return rows;
    }
    const [first, ...rest] = rows.map((row) => {
      const pnorm = precisionNorm(row.embedding, geometry);
      // updated_at は埋め込みを作り直したときだけ変える
      const updatedAt = postEmbeddings.updatedAt;
      return db
        .update(postEmbeddings)
        .set(column === "pnorm_a" ? { pnormA: pnorm, updatedAt } : { pnormB: pnorm, updatedAt })
        .where(eq(postEmbeddings.postId, row.postId));
    });
    if (first === undefined) {
      return written;
    }
    const saved = await db
      .batch([first, ...rest])
      .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
    if (saved instanceof Error) {
      return saved;
    }
    written += rows.length;
    after = rows.at(-1)?.postId ?? after;
  }
}

/** 新しい計量を公開する。検索は、この後に読んだ計量から column を使う。 */
export async function publishMetric({
  db,
  model,
  version,
  geometry,
  column,
  now,
}: {
  db: Database;
  model: string;
  version: number;
  geometry: Geometry;
  column: PnormColumn;
  now: Date;
}) {
  return db
    .update(embeddingMetrics)
    .set({
      version,
      mean: toBytes(Float32Array.from(geometry.mean)),
      precision: toBytes(Float32Array.from(geometry.precision)),
      pnormColumn: column,
      switchedAt: now,
    })
    .where(eq(embeddingMetrics.model, model))
    .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
}

/** 検索に使う計量を読む。統計の補正がまだ無い（version が 0、または行が無い）ときは null。 */
export async function loadMetric({ db, model }: { db: Database; model: string }) {
  const row = await db
    .select({
      version: embeddingMetrics.version,
      mean: embeddingMetrics.mean,
      precision: embeddingMetrics.precision,
      pnormColumn: embeddingMetrics.pnormColumn,
    })
    .from(embeddingMetrics)
    .where(eq(embeddingMetrics.model, model))
    .get()
    .catch((error: unknown) => new EmbeddingMetricError({ cause: error }));
  if (row instanceof Error) {
    return row;
  }
  if (!row || row.version === 0 || !row.mean || !row.precision) {
    return null;
  }
  return {
    version: row.version,
    mean: toFloat32(row.mean),
    precision: toFloat32(row.precision),
    pnormColumn: row.pnormColumn === "pnorm_a" ? "pnormA" : "pnormB",
  } satisfies Metric;
}
