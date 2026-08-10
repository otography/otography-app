import { describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import { catalogEntityMissingInTx } from "../../../shared/apple-music-catalog/sentinel";
import { withRaceRetry } from "../../../shared/apple-music-catalog/with-race-retry";

/*
 * テストリスト: withRaceRetry（レースコンディションのリトライ制御を汎用化したヘルパー）
 *
 * 1. attempt() が最初から成功すれば、recover() を呼ばずに recovered: true, value を返す
 * 2. attempt() が catalogEntityMissingInTx を返し、recover() が成功したら、attempt() を
 *    再実行してその結果を recovered: true, value として返す
 * 3. attempt() が catalogEntityMissingInTx を返し、recover() が Error を返したら、
 *    recovered: false, その Error を返す（attempt は1回しか呼ばれない）
 * 4. recover() 成功後の再実行でも catalogEntityMissingInTx が返る場合、
 *    recovered: false, fallbackErrorMessage を持つ DbError を返す
 * 5. attempt() が（センチネルではない）Error を返した場合、そのまま recovered: true, value として返す
 */
describe("withRaceRetry", () => {
  it("attempt() が最初から成功すれば、recover() を呼ばずに結果を返す", async () => {
    const attempt = vi.fn().mockResolvedValue({ id: "1" });
    const recover = vi.fn();

    const outcome = await withRaceRetry({
      attempt,
      recover,
      fallbackErrorMessage: "失敗しました。",
    });

    expect(outcome).toEqual({ recovered: true, value: { id: "1" } });
    expect(recover).not.toHaveBeenCalled();
  });

  it("センチネル→recover成功→再実行成功、で最終結果を返す", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce(catalogEntityMissingInTx)
      .mockResolvedValueOnce({ id: "2" });
    const recover = vi.fn().mockResolvedValue(undefined);

    const outcome = await withRaceRetry({
      attempt,
      recover,
      fallbackErrorMessage: "失敗しました。",
    });

    expect(outcome).toEqual({ recovered: true, value: { id: "2" } });
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("recover() が失敗したら、attempt を再実行せずそのエラーを返す", async () => {
    const recoverError = new DbError({ message: "リトライ用データの準備に失敗しました。" });
    const attempt = vi.fn().mockResolvedValue(catalogEntityMissingInTx);
    const recover = vi.fn().mockResolvedValue(recoverError);

    const outcome = await withRaceRetry({
      attempt,
      recover,
      fallbackErrorMessage: "失敗しました。",
    });

    expect(outcome).toEqual({ recovered: false, error: recoverError });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("recover後の再実行でもセンチネルなら、fallbackErrorMessageを持つDbErrorを返す", async () => {
    const attempt = vi.fn().mockResolvedValue(catalogEntityMissingInTx);
    const recover = vi.fn().mockResolvedValue(undefined);

    const outcome = await withRaceRetry({
      attempt,
      recover,
      fallbackErrorMessage: "楽曲情報の取得に失敗しました。",
    });

    expect(outcome.recovered).toBe(false);
    expect(outcome).toMatchObject({
      recovered: false,
      error: { message: "楽曲情報の取得に失敗しました。" },
    });
  });

  it("attempt() がセンチネルでないErrorを返した場合、そのまま結果として返す", async () => {
    const attemptError = new DbError({ message: "作成に失敗しました。" });
    const attempt = vi.fn().mockResolvedValue(attemptError);
    const recover = vi.fn();

    const outcome = await withRaceRetry({
      attempt,
      recover,
      fallbackErrorMessage: "失敗しました。",
    });

    expect(outcome).toEqual({ recovered: true, value: attemptError });
    expect(recover).not.toHaveBeenCalled();
  });
});
