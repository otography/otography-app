import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "db/constants";
import type { Database } from "../../lib/db.ts";
import { consumeChanges, publishMetric, readMetricState, writePnorms } from "../repository.ts";
import type { PnormColumn } from "../repository.ts";
import {
  drift,
  emptyMoments,
  geometryFromPrecision,
  momentsCount,
  toGeometry,
} from "../statistics.ts";

/** 計量を作るのに要る行数。共分散（k × k）を安定して求めるため、次元数の 10 倍とする。 */
const MIN_COUNT = 10 * EMBEDDING_DIMENSIONS;
/**
 * 計量を切り替えてから、次に切り替えるまで空ける時間。
 * 切り替えると、検索は新しい列を読む。古い計量をまだ持っている Worker は古い列を読むので、
 * その間に古い列を書き換えないよう、Worker が計量を読み直す間隔より長くする。
 */
const GRACE_MS = 15 * 60 * 1000;
/** この大きさ未満の変化では、計量を作り直さない（drift の 2 つの値に使う）。 */
const THRESHOLD = 0.05;

/**
 * 埋め込みの統計を取り込み、必要なら計量を作り直して切り替える。GitHub Actions から定期的に呼ぶ
 * （scripts/refresh-embedding-metric.ts）。同時に 2 つ動かさない。
 *
 * 1. 差分ログを統計に足す
 * 2. 公開中の計量があれば、その列がまだ空の行（前回の後に追加された行）に pnorm を書く
 * 3. 新しい計量を作り、公開中の計量との差が閾値を超えていれば、使っていない列に全行の pnorm を書いて切り替える
 *
 * publish が false の間は 1 だけを行う（統計を積み上げるが、検索の補正は始めない）。
 * 初期の投稿は公式アカウントの感想がほとんどで、利用者の投稿の分布とは違うため、十分に溜まってから有効にする。
 */
export async function refreshEmbeddingMetric({
  db,
  now,
  model = EMBEDDING_MODEL,
  minCount = MIN_COUNT,
  graceMs = GRACE_MS,
  threshold = THRESHOLD,
  publish,
}: {
  db: Database;
  now: Date;
  model?: string;
  minCount?: number;
  graceMs?: number;
  threshold?: number;
  publish: boolean;
}) {
  const state = await readMetricState({ db, model, emptyMoments: emptyMoments() });
  if (state instanceof Error) {
    return state;
  }

  const consumed = await consumeChanges({ db, model, moments: state.moments });
  if (consumed instanceof Error) {
    return consumed;
  }

  if (!publish) {
    return {
      model,
      version: state.version,
      consumed,
      count: momentsCount(state.moments),
      refreshed: false,
      reason: "publish_disabled",
    } as const;
  }

  const current =
    state.version > 0 && state.mean && state.precision
      ? geometryFromPrecision(state.mean, state.precision)
      : null;
  const filled = current
    ? await writePnorms({
        db,
        model,
        column: state.pnormColumn,
        geometry: current,
        onlyMissing: true,
      })
    : 0;
  if (filled instanceof Error) {
    return filled;
  }

  const summary = {
    model,
    version: state.version,
    consumed,
    filled,
    count: momentsCount(state.moments),
  };
  const next = summary.count >= minCount ? toGeometry(state.moments) : null;
  if (!next) {
    return { ...summary, refreshed: false, reason: "not_enough_rows" } as const;
  }

  const change = drift(current, next);
  if (change.precisionChange < threshold && change.meanShift < threshold) {
    return { ...summary, ...change, refreshed: false, reason: "small_change" } as const;
  }
  if (current && state.switchedAt && now.getTime() - state.switchedAt.getTime() < graceMs) {
    return { ...summary, ...change, refreshed: false, reason: "grace_period" } as const;
  }

  const column: PnormColumn = state.pnormColumn === "pnorm_a" ? "pnorm_b" : "pnorm_a";
  const written = await writePnorms({ db, model, column, geometry: next, onlyMissing: false });
  if (written instanceof Error) {
    return written;
  }
  // 全行に書いている間に追加された行にも書く。その行の統計は、次の実行で足す
  const late = await writePnorms({ db, model, column, geometry: next, onlyMissing: true });
  if (late instanceof Error) {
    return late;
  }

  const version = state.version + 1;
  const published = await publishMetric({ db, model, version, geometry: next, column, now });
  if (published instanceof Error) {
    return published;
  }
  return { ...summary, ...change, version, written: written + late, refreshed: true } as const;
}
