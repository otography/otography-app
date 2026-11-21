// find の戻り値は、行とエラーを分けずに 1 つの型引数（Found）で受け取る。行とエラーを別の型引数にすると、
// エラーの型引数が推論されずに Error になり、呼び出し側で個々のエラーの型が失われる。

/**
 * 保存済みの行があれば返す。読み出しに失敗したら、そのエラーを返す。
 * 行が無ければ、create（外部から取得して保存する処理）の結果を返す。
 */
export async function findOrCreate<Found, Created>({
  find,
  create,
}: {
  find: () => Promise<Found | null>;
  create: () => Promise<Created>;
}) {
  const existing = await find();
  if (existing !== null) {
    return existing;
  }
  return create();
}

/**
 * 行を INSERT し（主キーが衝突したら何もしない）、保存した行を返す。
 * 別のリクエストが同じ行を先に保存していた場合は、その行を読み直して返す。
 */
export async function insertOrFindExisting<Row, InsertError extends Error, Found, Missing>({
  insert,
  find,
  missing,
}: {
  insert: () => Promise<InsertError | Array<Row>>;
  find: () => Promise<Found | null>;
  missing: () => Missing;
}) {
  const inserted = await insert();
  if (inserted instanceof Error) {
    return inserted;
  }
  const [row] = inserted;
  if (row !== undefined) {
    return row;
  }

  const existing = await find();
  return existing ?? missing();
}
