-- Custom SQL migration file, put your code below! --

-- postgres は migration/admin 用の権限を維持する。
-- 以前このPRで入れた default role 変更が残っているDBでも戻せるようにする。
ALTER ROLE postgres RESET role;

-- Firebase ID → UUID 解決用の SECURITY DEFINER 関数
-- postgres 権限で実行されるため、anon ロールからでも安全に呼び出し可能
-- id のみを返し、他のカラムは見せない
CREATE OR REPLACE FUNCTION public.resolve_firebase_id(p_firebase_id varchar)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT id FROM public.users
  WHERE firebase_id = p_firebase_id AND deleted_at IS NULL
  LIMIT 1;
$$;

-- anon ロールに resolve_firebase_id の実行権限を付与
GRANT EXECUTE ON FUNCTION public.resolve_firebase_id(varchar) TO anon;

-- Firebase Auth と users テーブルの同期用 SECURITY DEFINER 関数。
-- アプリ実行ロールへ postgres への SET ROLE 権限を渡さず、許可された upsert だけを公開する。
CREATE OR REPLACE FUNCTION public.sync_firebase_user(p_firebase_id varchar)
RETURNS SETOF public.users
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  INSERT INTO public.users (firebase_id)
  VALUES (p_firebase_id)
  ON CONFLICT (firebase_id) DO UPDATE
  SET deleted_at = NULL, updated_at = now()
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.sync_firebase_user(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_firebase_user(varchar) TO authenticated;
