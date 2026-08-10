import { DbError } from "@repo/errors";
import { catalogEntityMissingInTx } from "./sentinel";

// レースコンディションのリトライ制御を汎用化したヘルパー。
// attempt() が catalogEntityMissingInTx を返したら recover() で不足していた状態を
// 補完し、1 回だけ再実行する。recover() 自体が失敗した場合は「リトライ用データの準備に
// 失敗した」ことを示すため、通常の DB エラー正規化を経由せずそのまま呼び出し元へ返す
// （recovered: false）。attempt() の結果（成功/エラーいずれも）は呼び出し元での
// 正規化対象として扱う（recovered: true）。
export const withRaceRetry = async <T>({
  attempt,
  recover,
  fallbackErrorMessage,
}: {
  attempt: () => Promise<T | typeof catalogEntityMissingInTx>;
  recover: () => Promise<Error | void>;
  fallbackErrorMessage: string;
}): Promise<{ recovered: true; value: T } | { recovered: false; error: Error }> => {
  let result = await attempt();

  if (result === catalogEntityMissingInTx) {
    const recoverResult = await recover();
    if (recoverResult instanceof Error) return { recovered: false, error: recoverResult };
    result = await attempt();
  }

  if (result === catalogEntityMissingInTx) {
    // recover 後も解決しない想定外ケース（型 narrowing のための防御的ガード）
    return { recovered: false, error: new DbError({ message: fallbackErrorMessage }) };
  }

  return { recovered: true, value: result };
};
