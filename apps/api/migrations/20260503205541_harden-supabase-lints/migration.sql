-- Custom SQL migration file, put your code below! --
ALTER FUNCTION public.gen_random_uuid_v7() SET search_path = pg_catalog;--> statement-breakpoint
ALTER FUNCTION public.uuid_generate_v7() SET search_path = pg_catalog;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql') THEN
    REVOKE USAGE ON SCHEMA graphql FROM anon, authenticated;
  END IF;
END
$$;--> statement-breakpoint
DROP EXTENSION IF EXISTS pg_graphql;
