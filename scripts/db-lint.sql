-- Supabase Database Linter 互換のローカル診断スクリプト
--
-- SPDX-License-Identifier: Apache-2.0
--
-- Copyright (c) Supabase, Inc.
-- Licensed under the Apache License, Version 2.0
--   https://github.com/supabase/supabase/blob/master/LICENSE
--
-- 公式ソース:
--   https://github.com/supabase/supabase/blob/master/packages/pg-meta/src/sql/studio/advisor/lints.ts
--
-- ローカルPostgreSQL向けの調整:
--   - pgrst.db_schemas → 'public' にハードコード
--   - auth スキーマ依存ルール (0002, 0010, 0013, 0015, 0016, 0017, 0019, 0021) → 除外
--   - SECURITY DEFINER 関数チェック (0028, 0029) → 追加（公式未収録）
--
-- 使い方:
--   just db-lint
--   nix run .#db-psql -- -f scripts/db-lint.sql

\pset format wrapped
\pset columns 140

-- PostgREST設定の代替（ローカルには pgrst がないため、public のみ検査）
-- pgrst.db_schemas を参照するルールは 'public' に置換済み

DO $$ BEGIN
  SET pg_stat_statements.track = none;
EXCEPTION WHEN OTHERS THEN
  -- スーパーユーザーでない、または拡張が未インストールの場合は無視
END $$;

SELECT
  name AS "lint",
  level,
  categories,
  detail,
  remediation
FROM (
-- ============================================================
-- 0001: Unindexed foreign keys (PERFORMANCE)
-- ============================================================
(
WITH foreign_keys AS (
    SELECT
        cl.relnamespace::regnamespace::text AS schema_name,
        cl.relname AS table_name,
        cl.oid AS table_oid,
        ct.conname AS fkey_name,
        ct.conkey AS col_attnums
    FROM
        pg_catalog.pg_constraint ct
        JOIN pg_catalog.pg_class cl
            ON ct.conrelid = cl.oid
        LEFT JOIN pg_catalog.pg_depend d
            ON d.objid = cl.oid AND d.deptype = 'e'
    WHERE
        ct.contype = 'f'
        AND d.objid IS NULL
        AND cl.relnamespace::regnamespace::text = 'public'
),
index_ AS (
    SELECT
        pi.indrelid AS table_oid,
        indexrelid::regclass AS index_,
        string_to_array(indkey::text, ' ')::smallint[] AS col_attnums
    FROM pg_catalog.pg_index pi
    WHERE indisvalid
)
SELECT
    '0001_unindexed_foreign_keys' AS name,
    'INFO' AS level,
    'PERFORMANCE' AS categories,
    format(
        'Table %I.%I has a foreign key %I without a covering index.',
        fk.schema_name, fk.table_name, fk.fkey_name
    ) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys' AS remediation
FROM foreign_keys fk
    LEFT JOIN index_ idx
        ON fk.table_oid = idx.table_oid
        AND fk.col_attnums = idx.col_attnums[1:array_length(fk.col_attnums, 1)]
    LEFT JOIN pg_catalog.pg_depend dep
        ON idx.table_oid = dep.objid AND dep.deptype = 'e'
WHERE idx.index_ IS NULL
    AND dep.objid IS NULL
ORDER BY fk.schema_name, fk.table_name, fk.fkey_name
)

UNION ALL

-- ============================================================
-- 0003: Auth RLS initplan (PERFORMANCE)
--   ローカルDBでは auth.uid() 等を使わないため、
--   requesting_user_id() / current_setting パターンをチェック
-- ============================================================
(
SELECT
    '0003_auth_rls_initplan' AS name,
    'WARN' AS level,
    'PERFORMANCE' AS categories,
    format(
        'Table %I.%I has RLS policy %I that re-evaluates current_setting() for each row. Replace current_setting(...) with (SELECT current_setting(...)).',
        pb.schemaname, pb.tablename, pb.policyname
    ) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan' AS remediation
FROM pg_catalog.pg_policies pb
WHERE pb.schemaname = 'public'
    AND (
        (lower(pb.qual) LIKE '%current\_setting(%)%' AND lower(pb.qual) NOT LIKE '%select current\_setting(%)%')
        OR (lower(pb.with_check) LIKE '%current\_setting(%)%' AND lower(pb.with_check) NOT LIKE '%select current\_setting(%)%')
    )
)

UNION ALL

-- ============================================================
-- 0004: No Primary Key (PERFORMANCE)
-- ============================================================
(
SELECT
    '0004_no_primary_key' AS name,
    'INFO' AS level,
    'PERFORMANCE' AS categories,
    format('Table %I.%I does not have a primary key', pgns.nspname, pgc.relname) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key' AS remediation
FROM pg_catalog.pg_class pgc
    JOIN pg_catalog.pg_namespace pgns ON pgns.oid = pgc.relnamespace
    LEFT JOIN pg_catalog.pg_index pgi ON pgi.indrelid = pgc.oid
    LEFT JOIN pg_catalog.pg_depend dep ON pgc.oid = dep.objid AND dep.deptype = 'e'
WHERE pgc.relkind = 'r'
    AND pgns.nspname = 'public'
    AND dep.objid IS NULL
GROUP BY pgc.oid, pgns.nspname, pgc.relname
HAVING max(coalesce(pgi.indisprimary, false)::int) = 0
)

UNION ALL

-- ============================================================
-- 0007: Policy Exists RLS Disabled (SECURITY)
-- ============================================================
(
SELECT
    '0007_policy_exists_rls_disabled' AS name,
    'ERROR' AS level,
    'SECURITY' AS categories,
    format(
        'Table %I.%I has RLS policies but RLS is not enabled. Policies: %s',
        n.nspname, c.relname, array_agg(p.polname ORDER BY p.polname)
    ) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0007_policy_exists_rls_disabled' AS remediation
FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON p.polrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_catalog.pg_depend dep ON c.oid = dep.objid AND dep.deptype = 'e'
WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND NOT c.relrowsecurity
    AND dep.objid IS NULL
GROUP BY n.nspname, c.relname
)

UNION ALL

-- ============================================================
-- 0008: RLS Enabled No Policy (SECURITY)
-- ============================================================
(
SELECT
    '0008_rls_enabled_no_policy' AS name,
    'INFO' AS level,
    'SECURITY' AS categories,
    format('Table %I.%I has RLS enabled, but no policies exist', n.nspname, c.relname) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy' AS remediation
FROM pg_catalog.pg_class c
    LEFT JOIN pg_catalog.pg_policy p ON p.polrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_catalog.pg_depend dep ON c.oid = dep.objid AND dep.deptype = 'e'
WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relrowsecurity
    AND p.polname IS NULL
    AND dep.objid IS NULL
GROUP BY n.nspname, c.relname
)

UNION ALL

-- ============================================================
-- 0009: Duplicate Index (PERFORMANCE)
-- ============================================================
(
SELECT
    '0009_duplicate_index' AS name,
    'WARN' AS level,
    'PERFORMANCE' AS categories,
    format(
        'Table %I.%I has identical indexes %s. Drop all except one.',
        n.nspname, c.relname, array_agg(pi.indexname ORDER BY pi.indexname)
    ) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index' AS remediation
FROM pg_catalog.pg_indexes pi
    JOIN pg_catalog.pg_namespace n ON n.nspname = pi.schemaname
    JOIN pg_catalog.pg_class c ON pi.tablename = c.relname AND n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_depend dep ON c.oid = dep.objid AND dep.deptype = 'e'
WHERE c.relkind IN ('r', 'm')
    AND n.nspname = 'public'
    AND dep.objid IS NULL
GROUP BY n.nspname, c.relkind, c.relname, replace(pi.indexdef, pi.indexname, '')
HAVING count(*) > 1
)

UNION ALL

-- ============================================================
-- 0011: Function Search Path Mutable (SECURITY)
-- ============================================================
(
SELECT
    '0011_function_search_path_mutable' AS name,
    'WARN' AS level,
    'SECURITY' AS categories,
    format('Function %I.%I has a role mutable search_path', n.nspname, p.proname) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable' AS remediation
FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    LEFT JOIN pg_catalog.pg_depend dep ON p.oid = dep.objid AND dep.deptype = 'e'
WHERE n.nspname = 'public'
    AND dep.objid IS NULL
    AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, '{}')) AS config
        WHERE config LIKE 'search_path=%'
    )
)

UNION ALL

-- ============================================================
-- 0024: RLS Policy Always True (SECURITY) — 公式SQLそのまま
-- ============================================================
(
WITH policies AS (
    SELECT
        nsp.nspname AS schema_name,
        pb.tablename AS table_name,
        pc.relrowsecurity AS is_rls_active,
        pa.polname AS policy_name,
        pa.polpermissive AS is_permissive,
        pa.polroles AS role_oids,
        (SELECT array_agg(r::regrole::text) FROM unnest(pa.polroles) AS x(r)) AS roles,
        CASE pa.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
        END AS command,
        pb.qual,
        pb.with_check,
        replace(replace(replace(lower(coalesce(pb.qual, '')), ' ', ''), E'\n', ''), E'\t', '') AS normalized_qual,
        replace(replace(replace(lower(coalesce(pb.with_check, '')), ' ', ''), E'\n', ''), E'\t', '') AS normalized_with_check
    FROM pg_catalog.pg_policy pa
        JOIN pg_catalog.pg_class pc ON pa.polrelid = pc.oid
        JOIN pg_catalog.pg_namespace nsp ON pc.relnamespace = nsp.oid
        JOIN pg_catalog.pg_policies pb
            ON pc.relname = pb.tablename
            AND nsp.nspname = pb.schemaname
            AND pa.polname = pb.policyname
    WHERE pc.relkind = 'r'
        AND nsp.nspname = 'public'
),
permissive_patterns AS (
    SELECT
        p.*,
        CASE WHEN (
            command IN ('UPDATE', 'DELETE', 'ALL')
            AND (
                normalized_qual IN ('true', '(true)', '1=1', '(1=1)')
                OR (qual IS NULL AND is_permissive)
            )
        ) THEN true ELSE false END AS has_permissive_using,
        CASE WHEN (
            normalized_with_check IN ('true', '(true)', '1=1', '(1=1)')
            OR (with_check IS NULL AND is_permissive AND command = 'INSERT')
            OR (with_check IS NULL AND is_permissive AND command IN ('UPDATE', 'ALL')
                AND normalized_qual IN ('true', '(true)', '1=1', '(1=1)'))
        ) THEN true ELSE false END AS has_permissive_with_check
    FROM policies p
    WHERE is_rls_active
        AND is_permissive
        AND (
            role_oids = array[0::oid]
            OR EXISTS (
                SELECT 1 FROM unnest(role_oids) AS r
                WHERE r::regrole::text IN ('anon', 'authenticated')
            )
        )
)
SELECT
    '0024_rls_policy_always_true' AS name,
    'WARN' AS level,
    'SECURITY' AS categories,
    format(
        'Table %I.%I has RLS policy %I for %s that allows unrestricted access%s. Bypasses RLS for %s.',
        schema_name, table_name, policy_name, command,
        CASE
            WHEN has_permissive_using AND has_permissive_with_check THEN ' (USING + WITH CHECK = true)'
            WHEN has_permissive_using THEN ' (USING = true)'
            WHEN has_permissive_with_check THEN ' (WITH CHECK = true)'
            ELSE ''
        END,
        array_to_string(roles, ', ')
    ) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy' AS remediation
FROM permissive_patterns
WHERE has_permissive_using OR has_permissive_with_check
ORDER BY schema_name, table_name, policy_name
)

UNION ALL

-- ============================================================
-- 0028: anon → SECURITY DEFINER Function (SECURITY)
--   公式未収録。Supabase Dashboard Advisor から移植。
-- ============================================================
(
SELECT
    '0028_anon_security_definer_function_executable' AS name,
    'WARN' AS level,
    'SECURITY' AS categories,
    format(
        'Function %I.%I(%s) is SECURITY DEFINER and executable by anon. Revoke EXECUTE or switch to SECURITY INVOKER.',
        n.nspname, p.proname, pg_get_function_arguments(p.oid)
    ) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable' AS remediation
FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
)

UNION ALL

-- ============================================================
-- 0029: authenticated → SECURITY DEFINER Function (SECURITY)
--   公式未収録。Supabase Dashboard Advisor から移植。
-- ============================================================
(
SELECT
    '0029_authenticated_security_definer_function_executable' AS name,
    'WARN' AS level,
    'SECURITY' AS categories,
    format(
        'Function %I.%I(%s) is SECURITY DEFINER and executable by authenticated. Revoke EXECUTE or switch to SECURITY INVOKER.',
        n.nspname, p.proname, pg_get_function_arguments(p.oid)
    ) AS detail,
    'https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable' AS remediation
FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
)

) AS lints
ORDER BY
    CASE level WHEN 'ERROR' THEN 1 WHEN 'WARN' THEN 2 WHEN 'INFO' THEN 3 END,
    name;
