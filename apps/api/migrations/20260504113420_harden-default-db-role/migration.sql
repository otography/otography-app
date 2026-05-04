-- Custom SQL migration file, put your code below! --

-- 接続時のデフォルトロールを anon に下げる（defense in depth）
-- postgres で接続後、自動的に anon になる
-- トランザクション内で set local role authenticated で一時昇格可能
ALTER ROLE postgres SET role TO 'anon';

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