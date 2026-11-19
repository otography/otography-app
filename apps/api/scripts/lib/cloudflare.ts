/**
 * バッチ（GitHub Actions）から Cloudflare の REST API で Workers AI と D1 を使う実装。
 * 必要な環境変数：CLOUDFLARE_ACCOUNT_ID、WORKERS_AI_API_TOKEN（Workers AI の Read と D1 の Edit の権限）。
 */
import * as errore from "errore";
import { EmbeddingRequestError, VectorStoreError } from "../../src/embeddings/errors.ts";
import {
  EMBEDDING_SOURCE,
  type Embedder,
  VECTOR_STORE_SCHEMA,
  type VectorStore,
} from "../../src/embeddings/vector-store.ts";
import { decodeHalf, encodeHalf, fromHex, toHex } from "../../src/embeddings/vectors.ts";

class MissingSettingError extends errore.createTaggedError({
  name: "MissingSettingError",
  message:
    "環境変数 $variable がありません。GitHub のシークレットか、手元の環境変数に入れてください",
}) {}

const setting = (name: string) => process.env[name] || new MissingSettingError({ variable: name });

type ApiResponse<T> = { success: boolean; result: T; errors?: { message: string }[] };

async function callApi<T>(path: string, init: RequestInit) {
  const account = setting("CLOUDFLARE_ACCOUNT_ID");
  if (account instanceof Error) return account;
  const token = setting("WORKERS_AI_API_TOKEN");
  if (token instanceof Error) return token;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).catch((e) => new Error(`${path} に接続できませんでした`, { cause: e }));
  if (res instanceof Error) return res;
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !body?.success) {
    const detail = body?.errors?.map((e) => e.message).join("; ") ?? "";
    return new Error(`${path} が失敗しました（HTTP ${res.status}）${detail}`);
  }
  return body.result;
}

/** Workers AI の REST API で埋め込みを作る。1 回の呼び出しで送る文は 50 件まで。 */
export const restEmbedder: Embedder = async (texts) => {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const result = await callApi<{ data: number[][] }>(`/ai/run/${EMBEDDING_SOURCE}`, {
      method: "POST",
      body: JSON.stringify({ text: texts.slice(i, i + 50) }),
    });
    if (result instanceof Error) return new EmbeddingRequestError({ cause: result });
    out.push(...result.data.map((vector) => Float32Array.from(vector)));
  }
  return out;
};

type D1Result = { results: Record<string, unknown>[] }[];

/** D1 の REST API で x の置き場所を使う。データベースは名前で探す。 */
export async function restVectorStore(name: string) {
  const list = await callApi<{ uuid: string; name: string }[]>(
    `/d1/database?name=${encodeURIComponent(name)}`,
    { method: "GET" },
  );
  if (list instanceof Error) return new VectorStoreError({ cause: list });
  const database = list.find((d) => d.name === name);
  if (!database) {
    return new VectorStoreError({
      cause: new Error(`D1 のデータベース ${name} がありません。Worker をデプロイすると作られます`),
    });
  }
  const query = (sql: string, params: unknown[] = []) =>
    callApi<D1Result>(`/d1/database/${database.uuid}/query`, {
      method: "POST",
      body: JSON.stringify({ sql, params }),
    });

  const created = await query(VECTOR_STORE_SCHEMA);
  if (created instanceof Error) return new VectorStoreError({ cause: created });

  const store: VectorStore & { listIds: () => Promise<VectorStoreError | Set<string>> } = {
    async put(rows) {
      // BLOB は REST API の params で渡せないので、16 進のリテラル（X'..'）で SQL に書く。1 文に 10 行まで。
      const now = Date.now();
      for (let i = 0; i < rows.length; i += 10) {
        const part = rows.slice(i, i + 10);
        const values = part.map((row) => `(?, ?, X'${toHex(encodeHalf(row.x))}', ${now})`);
        const sql = `INSERT OR IGNORE INTO x_vectors (post_id, source, embedding, created_at) VALUES ${values.join(", ")}`;
        const result = await query(
          sql,
          part.flatMap((row) => [row.postId, EMBEDDING_SOURCE]),
        );
        if (result instanceof Error) return new VectorStoreError({ cause: result });
      }
      return null;
    },
    async get(postIds) {
      const out = new Map<string, Float32Array>();
      for (let i = 0; i < postIds.length; i += 100) {
        const part = postIds.slice(i, i + 100);
        const result = await query(
          `SELECT post_id, hex(embedding) AS embedding FROM x_vectors WHERE post_id IN (${part.map(() => "?").join(", ")})`,
          part,
        );
        if (result instanceof Error) return new VectorStoreError({ cause: result });
        for (const row of result[0]?.results ?? []) {
          out.set(String(row.post_id), decodeHalf(fromHex(String(row.embedding))));
        }
      }
      return out;
    },
    async listIds() {
      const result = await query("SELECT post_id FROM x_vectors");
      if (result instanceof Error) return new VectorStoreError({ cause: result });
      return new Set((result[0]?.results ?? []).map((row) => String(row.post_id)));
    },
  };
  return store;
}
